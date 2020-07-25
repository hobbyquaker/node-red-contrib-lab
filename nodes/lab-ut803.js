module.exports = function (RED) {
    const Ut803 = require('../lib/ut803');

    class LabUt803 {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.configNode = RED.nodes.getNode(config.port);

            this.configNode.ut803.on('data', data => {
                this.send(Object.assign({topic: config.topic ? config.topic + '/' + data.measurement : data.measurement, payload: data.value}, data));
                this.status({shape: 'dot', fill: 'green', text: data.value + data.unit});
            });

            this.configNode.ut803.on('error', error => {
                this.error(error.message);
                this.status({shape: 'dot', fill: 'red', text: error.message});
            });

            this.configNode.ut803.on('open', () => {
                this.status({shape: 'ring', fill: 'green', text: 'connected'});
                this.connected = true;
            });

            this.configNode.ut803.on('close', () => {
                this.status({shape: 'ring', fill: 'red', text: 'disconnected'});
                this.connected = false;
            });

            this.configNode.ut803.on('active', active => {
                if (active) {
                    this.status({shape: 'dot', fill: 'green', text: 'receiving data'});
                } else if (this.connected) {
                    this.status({shape: 'ring', fill: 'green', text: 'connected'});
                }
            });
        }
    }

    class LabUt803Config {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.name = config.name;
            this.path = config.path;

            this.log('trying to open ' + this.path);
            this.ut803 = new Ut803({path: this.path});

            this.ut803.on('error', () => {
                setTimeout(() => this.ut803.serialport.open(), 10000);
            });

            this.ut803.on('open', () => {
                this.log('serconnected');
            });



            this.on('close', done => {
                this.ut803.close(() => {
                    this.log('port closed');
                    this.ut803.removeAllListeners();
                    done();
                });
            });
        }
    }

    RED.nodes.registerType('lab-ut803', LabUt803);
    RED.nodes.registerType('lab-ut803-config', LabUt803Config);
};
