'use strict';

const {Readable} = require('stream'),
  {createPlmBase} = require('./plmBase'),
  {createPlmBufferProcessor} = require('./plmBufferProcessor'),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),

  createPlmStream = (plmBase, pollingInterval = 50) => {
    let destroyCallback;

    const chunks = [],

      monitorHubStatus = async () => {
        const plmBufferProcessor = createPlmBufferProcessor();

        while (!destroyCallback) {
          const chunk =
            plmBufferProcessor.processPlmBuffer(await plmBase.getBuffer());

          if (chunk) {
            readable.push(chunk);
          }
          await sleep(pollingInterval);
        }
        destroyCallback();
      },

      read = () => {},

      destroy = (err, callback) => {
        destroyCallback = callback;
      },

      readable = new Readable({
        read,
        destroy,
        encoding: 'utf8'
      });

    monitorHubStatus();
    return readable;
  };

exports.createPlmStream = createPlmStream;