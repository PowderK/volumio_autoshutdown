'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var path = require('path');

module.exports = controller;

function controller(context) {
    var self = this;

    self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger = self.context.logger;
    self.configManager = self.context.configManager;
    
    // Inactivity Tracking State
    self.checkIntervalId = null;
    self.lastActiveTime = Date.now();
}

controller.prototype.onVolumioStart = function() {
    var self = this;
    var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
    self.config = new (require('v-conf'))();
    self.config.loadFile(configFile);
    
    return libQ.resolve();
};

controller.prototype.onStart = function() {
    var self = this;
    var defer = libQ.defer();

    self.log('Starting plugin...');
    self.startCheckLoop();

    defer.resolve();
    return defer.promise;
};

controller.prototype.onStop = function() {
    var self = this;
    var defer = libQ.defer();

    self.log('Stopping plugin...');
    self.stopCheckLoop();

    defer.resolve();
    return defer.promise;
};

controller.prototype.getConfigurationFiles = function() {
    return ['config.json'];
};

// =========================================================================
// UI Configuration Handlers
// =========================================================================

controller.prototype.getUIConfig = function() {
    var self = this;
    var defer = libQ.defer();

    var lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(
        path.join(__dirname, 'i18n', 'strings_' + lang_code + '.json'),
        path.join(__dirname, 'i18n', 'strings_en.json'),
        path.join(__dirname, 'UIConfig.json')
    )
    .then(function(uiconf) {
        var section = uiconf.sections[0];
        
        // 1. Switch: Enabled
        var enabledVal = self.config.get('enabled');
        section.content[0].value = (enabledVal !== undefined) ? enabledVal : true;
        
        // 2. Input: InactiveTime (Minutes)
        var inactiveVal = self.config.get('inactiveTime');
        section.content[1].value = (inactiveVal !== undefined) ? Number(inactiveVal) : 20;
        
        // 3. Input: CheckInterval (Seconds)
        var checkVal = self.config.get('checkInterval');
        section.content[2].value = (checkVal !== undefined) ? Number(checkVal) : 30;
        
        // 4. Select: Sound Card (Dynamically populated)
        var soundCards = self.getSoundcards();
        section.content[3].options = soundCards;
        
        var configuredCard = self.config.get('soundCard') || 'card1';
        var selectedCardOption = soundCards.find(function(c) { return c.value === configuredCard; }) || soundCards[0] || { value: 'card1', label: 'card1' };
        section.content[3].value = selectedCardOption;
        
        // 5. Select: Shutdown Method
        var shutdownMethod = self.config.get('shutdownMethod') || 'volumio';
        var selectedShutdownOption = section.content[4].options.find(function(o) { return o.value === shutdownMethod; }) || section.content[4].options[0];
        section.content[4].value = selectedShutdownOption;
        
        defer.resolve(uiconf);
    })
    .fail(function(err) {
        self.logger.error('Auto-Shutdown: Failed to parse UI Configuration: ' + err);
        defer.reject(new Error());
    });

    return defer.promise;
};

controller.prototype.saveConfig = function(data) {
    var self = this;

    // Parse and sanitize UI data
    var enabled = (data['enabled'] === true || data['enabled'] === 'true');
    var inactiveTime = Number(data['inactiveTime']);
    var checkInterval = Number(data['checkInterval']);
    
    var soundCard = data['soundCard'];
    if (soundCard && typeof soundCard === 'object' && soundCard.value !== undefined) {
        soundCard = soundCard.value;
    }
    
    var shutdownMethod = data['shutdownMethod'];
    if (shutdownMethod && typeof shutdownMethod === 'object' && shutdownMethod.value !== undefined) {
        shutdownMethod = shutdownMethod.value;
    }

    // Save persistent values using v-conf
    self.config.set('enabled', enabled);
    self.config.set('inactiveTime', inactiveTime);
    self.config.set('checkInterval', checkInterval);
    self.config.set('soundCard', soundCard);
    self.config.set('shutdownMethod', shutdownMethod);

    // Apply configuration immediately
    self.restartCheckLoop();

    // Show feedback toast in the WebUI
    var lang_code = self.commandRouter.sharedVars.get('language_code');
    self.commandRouter.i18nJson(
        path.join(__dirname, 'i18n', 'strings_' + lang_code + '.json'),
        path.join(__dirname, 'i18n', 'strings_en.json'),
        path.join(__dirname, 'UIConfig.json')
    )
    .then(function(strings) {
        self.commandRouter.pushToastMessage(
            'success',
            self.getTranslation(strings, 'AUTOSHUTDOWN.TOAST_SAVE_TITLE') || 'Configuration Saved',
            self.getTranslation(strings, 'AUTOSHUTDOWN.TOAST_SAVE_MSG') || 'Auto-shutdown settings have been successfully applied.'
        );
    });

    return libQ.resolve();
};

controller.prototype.getTranslation = function(obj, key) {
    if (!obj || !key) return '';
    var parts = key.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
        if (current[parts[i]] === undefined) return '';
        current = current[parts[i]];
    }
    return current;
};

// =========================================================================
// Sound Card Discovery Helpers
// =========================================================================

controller.prototype.getSoundcards = function() {
    var self = this;
    var cards = [];
    try {
        if (fs.existsSync('/proc/asound')) {
            var files = fs.readdirSync('/proc/asound');
            files.forEach(function(file) {
                // Look for directories like "card0", "card1", etc.
                if (file.startsWith('card') && !isNaN(file.replace('card', ''))) {
                    var cardPath = path.join('/proc/asound', file);
                    var cardName = file;
                    var idFile = path.join(cardPath, 'id');
                    if (fs.existsSync(idFile)) {
                        cardName = fs.readFileSync(idFile, 'utf8').trim();
                    }
                    
                    // Verify if card actually has playback (not just capture or control) subdevices
                    var subdirs = fs.readdirSync(cardPath);
                    var hasPlayback = false;
                    subdirs.forEach(function(sub) {
                        if (sub.startsWith('pcm') && sub.endsWith('p')) {
                            hasPlayback = true;
                        }
                    });
                    
                    if (hasPlayback) {
                        cards.push({
                            value: file,
                            label: cardName + ' (' + file + ')'
                        });
                    }
                }
            });
        }
    } catch (e) {
        self.logger.error('Auto-Shutdown: Error scanning sound cards: ' + e);
    }
    
    // Fallback if running on non-linux development system or no play cards detected
    if (cards.length === 0) {
        cards.push({ value: 'card1', label: 'Default Card (card1)' });
        cards.push({ value: 'card0', label: 'Onboard Audio (card0)' });
    }
    return cards;
};

controller.prototype.getPcmStatusFile = function(card) {
    var self = this;
    try {
        var cardPath = '/proc/asound/' + card;
        if (fs.existsSync(cardPath)) {
            var dirs = fs.readdirSync(cardPath);
            for (var i = 0; i < dirs.length; i++) {
                var d = dirs[i];
                // Check for playback subdevices (e.g. pcm0p, pcm1p)
                if (d.startsWith('pcm') && d.endsWith('p')) {
                    var statusFile = '/proc/asound/' + card + '/' + d + '/sub0/status';
                    if (fs.existsSync(statusFile)) {
                        return statusFile;
                    }
                }
            }
        }
    } catch (e) {
        self.logger.error('Auto-Shutdown: Error finding PCM status file for ' + card + ': ' + e);
    }
    return null;
};

controller.prototype.isPcmRunning = function(statusFile) {
    var self = this;
    if (!statusFile) return false;
    try {
        if (fs.existsSync(statusFile)) {
            var content = fs.readFileSync(statusFile, 'utf8');
            var lines = content.split('\n');
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.startsWith('state:')) {
                    var state = line.replace('state:', '').trim();
                    return state === 'RUNNING';
                }
            }
        }
    } catch (e) {
        self.logger.error('Auto-Shutdown: Error reading PCM status: ' + e);
    }
    return false;
};

// =========================================================================
// Background Activity / Inactivity Check Loop
// =========================================================================

controller.prototype.startCheckLoop = function() {
    var self = this;
    
    self.stopCheckLoop();

    var enabled = self.config.get('enabled');
    if (enabled === false) {
        self.log('Plugin is disabled. Not starting check loop.');
        return;
    }

    // Reset inactivity tracker on startup to prevent unexpected immediate shutdowns
    self.lastActiveTime = Date.now();
    
    var checkIntervalSec = self.config.get('checkInterval') || 30;
    var checkIntervalMs = checkIntervalSec * 1000;

    self.log('Starting inactivity monitor loop. Interval: ' + checkIntervalSec + 's');
    self.checkIntervalId = setInterval(self.checkInactivity.bind(self), checkIntervalMs);
};

controller.prototype.stopCheckLoop = function() {
    var self = this;
    if (self.checkIntervalId !== null) {
        self.log('Stopping inactivity monitor loop.');
        clearInterval(self.checkIntervalId);
        self.checkIntervalId = null;
    }
};

controller.prototype.restartCheckLoop = function() {
    var self = this;
    self.stopCheckLoop();
    self.startCheckLoop();
};

controller.prototype.checkInactivity = function() {
    var self = this;
    
    // 1. Check Volumio software status
    var volumioState = (self.commandRouter && self.commandRouter.stateMachine) ? self.commandRouter.stateMachine.getState() : null;
    var isVolumioPlaying = (volumioState && volumioState.status === 'play');

    // 2. Check Hardware sound card output (PCM State)
    var selectedCard = self.config.get('soundCard') || 'card1';
    var pcmStatusFile = self.getPcmStatusFile(selectedCard);
    var isPcmActive = self.isPcmRunning(pcmStatusFile);

    var now = Date.now();
    var isSystemActive = isVolumioPlaying || isPcmActive;

    if (isSystemActive) {
        // Reset the timer since there is active audio output or playback
        self.lastActiveTime = now;
        self.log('System is active. Resetting inactivity timer. (Volumio=' + (volumioState ? volumioState.status : 'N/A') + ', PCM=' + (isPcmActive ? 'RUNNING' : 'CLOSED') + ')');
    } else {
        var elapsedSec = Math.floor((now - self.lastActiveTime) / 1000);
        var inactiveMinutesConfig = self.config.get('inactiveTime') || 20;
        var thresholdSec = inactiveMinutesConfig * 60;

        self.log('System is inactive. Elapsed: ' + elapsedSec + 's / Limit: ' + thresholdSec + 's (Volumio=' + (volumioState ? volumioState.status : 'N/A') + ', PCM=CLOSED)');

        if (elapsedSec >= thresholdSec) {
            self.log('Inactivity threshold reached (' + elapsedSec + 's >= ' + thresholdSec + 's). Triggering shutdown.');
            self.triggerShutdown();
        }
    }
};

// =========================================================================
// Shutdown Execution Handlers
// =========================================================================

controller.prototype.triggerShutdown = function() {
    var self = this;
    
    // Stop check loop immediately to prevent double execution
    self.stopCheckLoop();
    
    var shutdownMethod = self.config.get('shutdownMethod') || 'volumio';
    
    if (shutdownMethod === 'onoffshim') {
        self.log('Shutting down via OnOff SHIM (GPIO17 Pulse sequence)...');
        
        var exec = require('child_process').exec;
        exec('command -v raspi-gpio', function(err, stdout, stderr) {
            if (!err && stdout.trim() !== '') {
                self.log('Using raspi-gpio for OnOff SHIM pulse.');
                exec('raspi-gpio set 17 op dl && sleep 0.2 && raspi-gpio set 17 ip pu', function(e, o, se) {
                    if (e) {
                        self.log('ERROR: raspi-gpio pulse failed: ' + e);
                        self.executeDirectShutdown();
                    }
                });
            } else {
                exec('command -v gpio', function(err2, stdout2, stderr2) {
                    if (!err2 && stdout2.trim() !== '') {
                        self.log('Using gpio (wiringPi) for OnOff SHIM pulse.');
                        exec('gpio -g mode 17 out && gpio -g write 17 0 && sleep 0.2 && gpio -g mode 17 in && gpio -g mode 17 up', function(e, o, se) {
                            if (e) {
                                self.log('ERROR: gpio pulse failed: ' + e);
                                self.executeDirectShutdown();
                            }
                        });
                    } else {
                        self.log('WARNING: No GPIO control utility found (neither raspi-gpio nor gpio). Falling back to direct shutdown.');
                        self.executeDirectShutdown();
                    }
                });
            }
        });
    } else {
        self.log('Shutting down via standard system command...');
        self.executeDirectShutdown();
    }
};

controller.prototype.executeDirectShutdown = function() {
    var self = this;
    var exec = require('child_process').exec;
    
    self.log('Executing sudo shutdown -h now...');
    exec('sudo /sbin/shutdown -h now', function(err, stdout, stderr) {
        if (err) {
            self.log('ERROR: Standard shutdown failed: ' + err + '. Trying sudo poweroff fallback.');
            exec('sudo poweroff', function(err2, stdout2, stderr2) {
                if (err2) {
                    self.log('ERROR: Direct poweroff failed: ' + err2);
                }
            });
        }
    });
};

controller.prototype.log = function(message) {
    var self = this;
    var timestamp = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    var logMsg = timestamp + ' - ' + message + '\n';
    
    self.logger.info('Auto-Shutdown: ' + message);
    
    try {
        fs.appendFileSync('/var/log/volumio-autoshutdown.log', logMsg);
    } catch (e) {
        try {
            fs.appendFileSync('/home/volumio/volumio-autoshutdown.log', logMsg);
        } catch (e2) {
            // Ignore write failures (e.g. read-only filesystem or permissions)
        }
    }
};
