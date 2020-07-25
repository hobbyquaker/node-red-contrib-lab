const {EventEmitter} = require('events');

const SerialPort = require('serialport');
const Delimiter = require('@serialport/parser-delimiter');

const protocol = {
    measurementType: {
        1: 'diode',
        2: 'frequency',
        3: 'resistance',
        4: 'temperature',
        5: 'continuity',
        6: 'capacitance',
        9: 'current',
        11: 'voltage',
        13: 'current',
        14: 'hFE',
        15: 'current'
    },
    units: {
        1: 'V',
        2: 'Hz',
        3: 'Ohm',
        5: 'Ohm',
        6: 'F',
        9: 'A',
        11: 'V',
        13: 'uA',
        14: '',
        15: 'mA'
    },
    exponent: {
        V: -3,
        Ohm: -1,
        A: -2,
        mA: -2,
        uA: -1,
        F: -12,
        Hz: 0
    }
};

module.exports = class Ut803 extends EventEmitter {
    constructor(options) {
        super();

        this.path = options.path;

        this.serialport = new SerialPort(
            this.path, {
                baudRate: 19200,
                dataBits: 7,
                stopBits: 1,
                startBits: 1,
                parity: 'odd'
            }
        );

        this.active = false;
        this.activeTimeout = null;

        this.serialport.on('error', error => {
            console.log('ut803 error', error)
            this.emit('error', error)
        });
        this.serialport.on('open', () => {
            this.emit('open');
        });

        this.serialport.on('close', reason => {
            this.emit('close', reason);
        });

        this.parser = this.serialport.pipe(new Delimiter({
            delimiter: '\r\n'
        }));

        this.data = {};

        this.parser.on('data', data => {
            clearTimeout(this.activeTimeout);
            this.activeTimeout = setTimeout(() => {
                this.active = false;
                this.emit('active', this.active);
            }, 1000);

            if (!this.active) {
                this.active = true;
                this.emit('active', this.active);
            }

            const measurement = protocol.measurementType[data[5] & 0x0F];
            const unit = protocol.units[data[5] & 0x0F];

            let value = Number.parseInt(Buffer.from([data[1], data[2], data[3], data[4]]).toString(), 10);
            const negative = Boolean(data[6] & 0x04);
            let exponent = Number.parseInt(Buffer.from([data[0]]).toString(), 10);
            if (unit === 'V' && exponent & 0x04) {
                exponent -= 2;
            }

            exponent += protocol.exponent[unit];
            value *= 10 ** exponent;
            if (negative) {
                value = -value;
            }

            value = Math.round(value * 1e6) / 1e6;

            const overload = Boolean(data[6] & 0x01);
            const notFarenheit = Boolean(data[6] & 0x08);
            const minimum = Boolean(data[7] & 0x02);
            const maximum = Boolean(data[7] & 0x04);
            const hold = Boolean(data[7] & 0x08);

            const autoRange = Boolean(data[8] & 0x02);
            const ac = Boolean(data[8] & 0x04);
            const dc = Boolean(data[8] & 0x09);

            const newData = {
                measurement,
                value,
                unit,
                exponent,
                hold,
                autoRange,
                ac,
                dc,
                overload,
                notFarenheit,
                minimum,
                maximum
            };

            let change = false;

            Object.keys(newData).forEach(key => {
                if (this.data[key] !== newData[key]) {
                    change = true;
                }
            });

            this.data = newData;

            if (change) {
                this.emit('data', this.data);
            }
        });
    }

    close(cb) {
        this.serialport.close(cb);
    }
};
