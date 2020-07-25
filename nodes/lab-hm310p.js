module.exports = function (RED) {
    const Hm310 = require('../lib/hm310');

    class LabHm310p {
        constructor(config) {
            RED.nodes.createNode(this, config);

            this.configNode = RED.nodes.getNode(config.port);

            this.values = {};

            this.on('input', (message, send, done) => {
                const key = message.topic.split('/').pop().toLowerCase();
                switch (key) {
                    case 'powerswitch':
                    case 'power':
                    case 'switch':
                    case 'output':
                        this.configNode.hm310.write('powerSwitch', message.payload);
                        break;

                    case 'protectvoltage':
                        this.configNode.hm310.write('protectVoltage', message.payload);
                        break;

                    case 'protectcurrent':
                        this.configNode.hm310.write('protectCurrent', message.payload);
                        break;

                    case 'protectpower':
                        this.configNode.hm310.write('protectPower', message.payload);
                        break;

                    case 'setvoltage':
                    case 'voltage':
                        this.configNode.hm310.write('setVoltage', message.payload);
                        break;

                    case 'setcurrent':
                    case 'current':
                        this.configNode.hm310.write('setCurrent', message.payload);
                        break;

                    default:
                        this.warn('unknown topic ' + message.topic);
                }

                done();
            });

            this.configNode.hm310.on('value', (key, value) => {
                this.values[key] = value;
                this.send({topic: config.topic ? config.topic + '/' + key : key, payload: value});
                this.status({
                    shape: this.values.powerSwitch ? 'dot' : 'ring',
                    fill: 'green',
                    text: this.values.powerSwitch ?
                        this.values.voltage + 'V ' + this.values.current + 'A ' + this.values.power + 'W' :
                        this.values.setVoltage + 'V ' + this.values.setCurrent + 'A (off)'
                });
            });

            this.configNode.hm310.on('error', error => {
                this.error(error);
                this.status({shape: 'ring', fill: 'red', text: error.message});
            });

            this.configNode.hm310.on('connected', connected => {
                if (connected) {
                    this.status({shape: 'dot', fill: 'green', text: 'connected'});
                } else {
                    this.status({shape: 'dot', fill: 'red', text: 'disconnected'});
                }
            });
        }
    }

    class LabHm310pConfig {
        constructor(config) {
            RED.nodes.createNode(this, config);
            this.name = config.name;
            this.path = config.path;

            this.log('trying to open ' + this.path);
            this.hm310 = new Hm310({port: this.path});

            this.on('close', done => {
                this.hm310.close();
                this.hm310.removeAllListeners();
                done();
            });
        }
    }

    RED.nodes.registerType('lab-hm310p', LabHm310p);
    RED.nodes.registerType('lab-hm310p-config', LabHm310pConfig);
};
