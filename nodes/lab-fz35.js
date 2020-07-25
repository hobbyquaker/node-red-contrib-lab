module.exports = function (RED) {
    const Fz35 = require('../lib/fz35');

    class LabFz35 {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.configNode = RED.nodes.getNode(config.port);

            this.on('input', (message, send, done) => {
                const key = message.topic.split('/').pop().toLowerCase();

                switch (key) {
                    case 'powerswitch':
                        this.configNode.fz35.command(message.payload ? 'on' : 'off').then(() => done()).catch(error => done(error));
                        break;

                    case 'setcurrent':
                        if (typeof message.payload !== 'number') {
                            done(new Error('msg.payload has to be type number for topic setCurrent'));
                            return;
                        }

                        this.configNode.fz35.command(message.payload.toFixed(2) + 'A').then(() => done()).catch(error => done(error));
                        break;

                    case 'lvp':
                    case 'ovp':
                    case 'ocp':
                    case 'opp':
                    case 'oah':
                    case 'ohp':
                        if (typeof message.payload !== 'number') {
                            done(new Error('msg.payload has to be type number for topic ' + key));
                            return;
                        }

                        this.configNode.fz35.command(key.toUpperCase() + ':' + message.payload.toFixed(2)).then(() => done()).catch(error => done(error));
                        break;

                    default:
                        done(new Error('invalid msg.topic'));
                }
            });

            this.configNode.fz35.on('protection', protection => {
                this.protection = protection;
                if (protection) {
                    this.status({shape: 'ring', fill: 'yellow', text: protection.toUpperCase()});
                } else {
                    this.status({shape: 'dot', fill: 'green', text: ''});
                }
            });

            this.configNode.fz35.on('data', data => {
                console.log('fz35 protected...', this.protection);
                if (!this.protection) {
                    console.log('... status!')
                    this.status({shape: (data.current > 0 && data.voltage > 0) ? 'dot' : 'ring', fill: 'green', text: data.voltage + 'V ' + data.current + 'A'});
                } else {

                }

                Object.keys(data).forEach(key => {
                    this.send({topic: config.topic ? config.topic + '/' + key : key, payload: data[key]});
                });
            });

            this.configNode.fz35.on('error', error => {
                this.status({shape: 'ring', fill: 'red', text: error.message});
                //this.error(error.message);
            });
        }
    }

    class LabFz35Config {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.name = config.name;
            this.path = config.path;

            this.log('trying to open ' + this.path);
            this.fz35 = new Fz35({port: this.path});

            this.on('close', done => {
                this.fz35.serialport.close(() => {
                    this.fz35.removeAllListeners();
                    done();
                });
            });
        }
    }

    RED.nodes.registerType('lab-fz35', LabFz35);
    RED.nodes.registerType('lab-fz35-config', LabFz35Config);
};
