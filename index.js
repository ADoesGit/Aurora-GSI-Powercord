const { Plugin } = require('powercord/entities');
const { getModule, channels, FluxDispatcher } = require('powercord/webpack');
const debounce = require('./debounce.js')


module.exports = class AuroraGSI extends Plugin {
  constructor (props) {
    super(props);
    this.sendJsonToAurora = debounce(this.sendJsonToAurora, 100);
  }

  getSelectedGuild () {
    const channel = this.getChannel(this.channels.getChannelId());
    return channel ? this.getGuild(channel.guild_id) : null;
  }

  getSelectedTextChannel () {
    return this.getChannel(this.channels.getChannelId());
  }

  getSelectedVoiceChannel () {
    return this.getChannel(this.channels.getVoiceChannelId());
  }

  getLocalStatus () {
    return this.getStatus(this.getCurrentUser()?.id);
  }

  startPlugin () {
    this.json = {
      provider: {
        name: 'discord',
        appid: -1
      },
      user:{
        id: -1,
        status: 'undefined',
        self_mute: false,
        self_deafen : false,
        mentions: false,
        mention_count: 0,
        unread_guilds_count: 0,
        unread_messages: false,
        being_called: false
      },
      guild: {
        id: -1,
        name: ''
      },
      text: {
        id: -1,
        type: -1,
        name: ''
      },
      voice: {
        id: -1,
        type: -1,
        name: ''
      }
    };
    // eslint-disable-next-line no-unused-expressions
    this.lastJson;
    this.getCurrentUser = getModule([ 'getUser', 'getUsers' ], false).getCurrentUser;
    this.getStatus = getModule([ 'getApplicationActivity' ], false).getStatus;
    this.getChannel = getModule([ 'getChannel' ], false).getChannel;
    this.getGuild = getModule([ 'getGuild' ], false).getGuild;
    this.channels = channels;
    const { getUser } = getModule([ 'getUser' ], false),
      voice = getModule([ 'isMute', 'isDeaf', 'isSelfMute', 'isSelfDeaf' ], false),
      { getCalls } = getModule([ 'getCalls' ], false),
      { getUnreadGuilds } = getModule([ 'getUnreadGuilds' ], false),
      { getTotalMentionCount } = getModule([ 'getTotalMentionCount' ], false),
      isMute = voice.isMute.bind(voice),
      isDeaf = voice.isDeaf.bind(voice),
      isSelfMute = voice.isSelfMute.bind(voice),
      isSelfDeaf = voice.isSelfDeaf.bind(voice);
      /*
       * { getChannel } = getModule([ 'getChannel' ], false), // we dont use this yet
       * const { getVoiceStates } = getModule([ 'getVoiceState' ], false),
       */
    this.handler = (props) => {
      // eslint-disable-next-line consistent-this
      const localUser = this.getCurrentUser();
      const localStatus = this.getLocalStatus();
      /*
       * if (voiceChannel) {
       *   var voiceStates = getVoiceStates(voiceChannel.guild_id);
       * } not implemented
       */
      switch (props.type) {
        case 'PRESENCE_UPDATE':
          if (localUser && localStatus) {
            this.json.user.id = localUser?.id;
            this.json.user.status = localStatus;
          } else {
            this.json.user.id = -1;
            this.json.user.status = '';
          }
          break;

        case 'CHANNEL_SELECT':
          const guild = this.getGuild(props.guildId);
          const textChannel = this.getChannel(props.channelId);
          if (guild) {
            this.json.guild.id = guild.id;
            this.json.guild.name = guild.name;
          } else {
            this.json.guild.id = -1;
            this.json.guild.name = '';
          }
          if (textChannel) {
            this.json.text.id = textChannel.id;
            if (textChannel.type === 0) { // text channel
              this.json.text.type = 0;
              this.json.text.name = textChannel.name;
            } else if (textChannel.type === 1) { // pm
              this.json.text.type = 1;
              this.json.text.name = getUser(textChannel.recipients[0]).username;
            } else if (textChannel.type === 3) { // group pm
              this.json.text.type = 3;
              if (textChannel.name) {
                this.json.text.name = textChannel.name;
              } else {
                let newname = '';
                for (let i = 0; i < textChannel.recipients.length; i++) {
                  const user = textChannel.recipients[i];
                  newname += `${getUser(user).username} `;
                }
                this.json.text.name = newname;
              }
            }
          } else {
            this.json.text.id = -1;
            this.json.text.type = -1;
            this.json.text.name = '';
          }
          break;

        case 'VOICE_CHANNEL_SELECT':
          const voiceChannel = this.getChannel(props.channelId);
          if (voiceChannel) {
            if (voiceChannel.type === 1) { // call
              this.json.voice.type = 1;
              this.json.voice.id = voiceChannel.id;
              this.json.voice.name = getUser(voiceChannel.recipients[0]).username;
            } else if (voiceChannel.type === 2) { // voice channel
              this.json.voice.type = 2;
              this.json.voice.id = voiceChannel.id;
              this.json.voice.name = voiceChannel.name;
            }
          } else {
            this.json.voice.id = -1;
            this.json.voice.type = -1;
            this.json.voice.name = '';
          }
          break;

        case 'USER_VOICE_UPDATE':
          this.json.user.self_mute = props.self_mute;
          this.json.user.self_deafen = props.self_deafen;
          this.json.user.mute = props.mute;
          this.json.user.deafen = props.deafen;
          break;

        case 'UNREADS_UPDATE':
          this.json.user.unread_messages = props.unreads > 0;
          this.json.user.unread_guilds_count = props.unreads;
          break;
        case 'MENTIONS_UPDATE':
          this.json.user.mentions = props.mentions > 0;
          this.json.user.mention_count = props.mentions;
          break;
        case 'CALL_RING_UPDATE':
          this.json.user.being_called = props.being_called;
          break;
        case 'SETUP':
          this.json.user.id = this.getCurrentUser()?.id;
          this.json.user.status = this.getLocalStatus;
          this.json.user.self_mute = isSelfMute();
          this.json.user.self_deafen = isSelfDeaf();
          this.json.user.mentions = getTotalMentionCount().length > 0;
          this.json.user.mention_count = getTotalMentionCount().length;
          this.json.user.unread_guilds_count = Object.values(getUnreadGuilds()).length;
          this.json.user.unread_messages = Object.values(getUnreadGuilds()).length > 0;
          break;
        default:
          break;
      }

      if (JSON.stringify(this.json) !== this.lastJson) {
        this.lastJson = JSON.stringify(this.json);
        this.sendJsonToAurora(this.json);
      }
    };

    const timeoutEventHandlers = () => {
      const voice = {};
      voice.self_mute = isSelfMute();
      voice.self_deafen = isSelfDeaf();
      voice.mute = isMute();
      voice.deafen = isDeaf();
      if (this.voice.mute !== voice.mute || this.voice.deafen !== voice.deafen) {
        this.handler({ type: 'USER_VOICE_UPDATE',
          ...voice });
        Object.assign(this.voice, voice);
      }
    };

    this.detectMention = (props) => {
      const uid = this.getCurrentUser()?.id;
      const mentions = getTotalMentionCount();
      if (props.message && !props.message.sendMessageOptions && props.message.author.id !== uid && this.mentions !== mentions) {
        this.handler({ type: 'MENTIONS_UPDATE',
          mentions });
        this.mentions = mentions;
      }
      const unreads = Object.keys(getUnreadGuilds()).length;
      if (unreads !== this.unreads) {
        this.handler({ type: 'UNREADS_UPDATE',
          unreads });
        this.unreads = unreads;
      }
    };

    this.detectPresence = (props) => {
      if (props.user.id === this.getCurrentUser()?.id) {
        this.handler(props);
      }
    };

    this.detectCall = () => {
      setTimeout(() => {
        const being_called = (getCalls().filter((x) => x.ringing.length > 0).length > 0);
        if (being_called !== this.voice.being_called) {
          this.handler({ type: 'CALL_RING_UPDATE',
            being_called });
          this.voice.being_called = being_called;
        }
      }, 100);
    };
    FluxDispatcher.subscribe('MESSAGE_CREATE', this.detectMention);
    FluxDispatcher.subscribe('CHANNEL_SELECT', this.handler);
    FluxDispatcher.subscribe('VOICE_CHANNEL_SELECT', this.handler);
    FluxDispatcher.subscribe('PRESENCE_UPDATE', this.detectPresence);
    FluxDispatcher.subscribe('CALL_CREATE', this.detectCall);
    this.voice = {};
    this.unreads = 0;
    this.mentions = 0;
    this.interval = setInterval(timeoutEventHandlers, 100);
    const setupInterval = setInterval(() => {
      const u = this.getCurrentUser();
      if (u?.id) {
        clearInterval(setupInterval);
        this.handler({ type: 'SETUP' });
      }
    }, 100);
  }


  pluginWillUnload () {
    this.ready = false;
    clearInterval(this.interval);
    FluxDispatcher.unsubscribe('MESSAGE_CREATE', this.detectMention);
    FluxDispatcher.unsubscribe('CHANNEL_SELECT', this.handler);
    FluxDispatcher.unsubscribe('VOICE_CHANNEL_SELECT', this.handler);
    FluxDispatcher.unsubscribe('PRESENCE_UPDATE', this.detectPresence);
    FluxDispatcher.unsubscribe('CALL_CREATE', this.detectCall);
  }

  async sendJsonToAurora (json) {
    fetch('http://localhost:9088/', {
      method: 'POST',
      body: JSON.stringify(json),
      mode:'no-cors',
      headers:{
        'Content-Type': 'application/json'
      }
    })
      .catch(error => console.warn(`Aurora GSI error: ${error}`));
  }
};
