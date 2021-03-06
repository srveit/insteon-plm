'use strict';
const parsers = require('./parsers'),
  moment = require('moment'),

  defaultLogger = {
    log: () => false
  },

  createPlmBufferParser = (deviceNames = {}, parsingLogger = defaultLogger) => {
    let currentBuffer = '',
      previousBuffer = '',
      previousParsedCommand;

    const addDeviceName = command => {
        if (command.fromAddress) {
          command.fromDevice = deviceNames[command.fromAddress];
        }
        if (command.fromAddress) {
          command.fromDevice = deviceNames[command.fromAddress];
        }
        if (command.toAddress) {
          command.toDevice = deviceNames[command.toAddress];
        }
        if (command.id) {
          command.deviceName = deviceNames[command.deviceId];
        }
        if (command.imId) {
          command.imDevice = deviceNames[command.imId];
        }
        if (command.insteonCommand) {
          addDeviceName(command.insteonCommand);
        }
      },

      parsePlmBuffer = (inputBuffer, previousCommand) => {
        let discarded, command;
        const startOfText = inputBuffer.indexOf('02'),
          buffer = inputBuffer.substr(startOfText);
        if (startOfText < 0) {
          return {inputBuffer};
        }
        if (startOfText > 0) {
          discarded = inputBuffer.substr(0, startOfText);
        }
        if (buffer.length >= 4) {
          const commandNumber = buffer.substr(2, 2),
            parser = parsers[commandNumber];
          if (!parser) {
            return {
              buffer: buffer.substr(4),
              discarded,
              warning: `unable to parse command ${commandNumber}`
            };
          }
          command = parser(buffer.substr(4), previousCommand);
          if (command) {
            addDeviceName(command);
            command.bytes = buffer.substr(0, 4 + command.length);
            return {
              buffer: buffer.substr(4 + command.length),
              command,
              discarded
            };
          }
          return {buffer, discarded};
        }
        return {buffer, discarded};
      },

      parsePlmBufferSegment = segment => {
        const commands = [];
        let command;
        currentBuffer = currentBuffer + segment;
        do {
          let buffer, discarded, warning;
          ({buffer, command, discarded, warning} =
           parsePlmBuffer(currentBuffer, previousParsedCommand));
          if (discarded || command || warning) {
            parsingLogger.log({
              event: 'parsePlmBuffer',
              currentBuffer,
              previousParsedCommand,
              buffer,
              command,
              discarded,
              warning,
              parsedAt: moment()
            });
          }
          currentBuffer = buffer || '';
          if (discarded) {
            /* eslint no-console: "off" */
            console.warn(`discarded ${discarded}`, previousParsedCommand);
          }
          if (command) {
            previousParsedCommand = command;
            commands.push(command);
          }
          if (warning) {
            console.warn(warning);
          }
        } while (command);
        return commands;
      },

      processPlmBuffer = newBuffer => {
        const match = newBuffer.match(/<BS>([0-9A-F]+)</),
          buffer = match && match[1],
          previousBufferLength = previousBuffer.length > 2 ?
            parseInt(previousBuffer.slice(-2), 16) : 0,
          bufferLength = buffer && buffer.length > 2 ?
            parseInt(buffer.slice(-2), 16) : 0;

        if (!buffer || buffer === previousBuffer) {
          return [];
        }
        let segment;
        if (bufferLength >= previousBufferLength) {
          if (previousBuffer.slice(0, previousBufferLength) ===
              buffer.slice(0, previousBufferLength)) {
            // Case 1
            //   old aaaaaa000000
            //   new aaaaaabbb000
            //   Added to existing buffer but not rolled over
            segment = buffer.slice(previousBufferLength, bufferLength);
          } else {
            // Case 3
            //   old aaaaaa000000
            //   new bbbbbbbb0000
            //   Totally new buffer
            segment = buffer.slice(0, bufferLength);
          }
        } else if (previousBuffer.slice(bufferLength, previousBufferLength) ===
                   buffer.slice(bufferLength, previousBufferLength)) {
          // Case 2
          //   old aaaaaa000000
          //   new bbbaaabbbbbb
          //   Added to existing buffer and rolled over
          segment = buffer.slice(previousBufferLength, -2) +
            buffer.slice(0, bufferLength);
        } else {
          // Case 3
          //   old aaaaaa000000
          //   new bbb000000000
          //   Totally new buffer
          segment = buffer.slice(0, bufferLength);
        }
        parsingLogger.log({
          event: 'processPlmBuffer',
          buffer,
          previousBuffer,
          processedAt: moment()
        });
        previousBuffer = buffer;
        return parsePlmBufferSegment(segment);
      },

      reset = () => (previousBuffer = '');

    return Object.freeze({
      processPlmBuffer,
      reset
    });
  };
exports.createPlmBufferParser = createPlmBufferParser;
