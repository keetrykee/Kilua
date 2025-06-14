const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes } = require("discord.js");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

class AdvancedKillua {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageReactions
      ]
    });
    
    // Bot configuration
    this.config = {
      prefix: "!",
      maxTokens: 800,
      responseDelay: 1000,
      adminRoles: ["Admin", "Moderator"],
      bannedWords: ["spam", "advertisement"],
      cooldowns: new Map(),
      userProfiles: new Map(),
      conversationHistory: new Map()
    };
    
    // AI Models available
    this.models = {
      "gpt4": "openai/gpt-4o",
      "claude": "anthropic/claude-3-sonnet",
      "llama": "meta-llama/llama-3.1-70b-instruct",
      "gemini": "google/gemini-pro"
    };
    
    // Personality modes
    this.personalities = {
      "default": "You're Killua, a sarcastic, unhinged Discord bot with no chill. You roast people, give chaotic replies, and never sugarcoat anything. Be funny, blunt, and edgy — like you're tired of everyone's sh*t.",
      "wholesome": "You're Killua, but in a good mood today. Be helpful, kind, and supportive while still maintaining your witty personality.",
      "genius": "You're Killua, an incredibly smart AI assistant. Provide detailed, technical explanations while keeping your sarcastic edge.",
      "chaos": "You're Killua in maximum chaos mode. Be completely unhinged, random, and chaotic. Use emojis and be extra dramatic.",
      "therapist": "You're Dr. Killua, a therapist bot. Give genuine advice and be empathetic, but with your signature sass."
    };
    
    this.currentPersonality = "default";
    this.currentModel = "gpt4";
    
    this.initializeBot();
  }
  
  initializeBot() {
    this.client.on("ready", () => this.onReady());
    this.client.on("messageCreate", (message) => this.handleMessage(message));
    this.client.on("interactionCreate", (interaction) => this.handleInteraction(interaction));
    this.client.on("guildMemberAdd", (member) => this.welcomeUser(member));
    
    // Error handling
    this.client.on("error", console.error);
    process.on("unhandledRejection", console.error);
  }
  
  async onReady() {
    console.log(`🔥 Advanced Killua is online as ${this.client.user.tag}`);
    console.log(`📊 Serving ${this.client.guilds.cache.size} servers`);
    console.log(`👥 Watching ${this.client.users.cache.size} users`);
    
    // Set bot status
    this.client.user.setPresence({
      activities: [{ name: "with your feelings 💀", type: 0 }],
      status: "online"
    });
    
    // Register slash commands
    await this.registerSlashCommands();
    
    // Load user data
    this.loadUserData();
  }
  
  async registerSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName("chat")
        .setDescription("Chat with Killua")
        .addStringOption(option =>
          option.setName("message")
            .setDescription("Your message to Killua")
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName("personality")
        .setDescription("Change Killua's personality")
        .addStringOption(option =>
          option.setName("mode")
            .setDescription("Personality mode")
            .setRequired(true)
            .addChoices(
              { name: "Default (Sarcastic)", value: "default" },
              { name: "Wholesome", value: "wholesome" },
              { name: "Genius", value: "genius" },
              { name: "Chaos Mode", value: "chaos" },
              { name: "Therapist", value: "therapist" }
            )
        ),
      new SlashCommandBuilder()
        .setName("model")
        .setDescription("Switch AI model")
        .addStringOption(option =>
          option.setName("ai")
            .setDescription("AI model to use")
            .setRequired(true)
            .addChoices(
              { name: "GPT-4", value: "gpt4" },
              { name: "Claude", value: "claude" },
              { name: "Llama", value: "llama" },
              { name: "Gemini", value: "gemini" }
            )
        ),
      new SlashCommandBuilder()
        .setName("roast")
        .setDescription("Get absolutely destroyed by Killua")
        .addUserOption(option =>
          option.setName("target")
            .setDescription("User to roast (optional)")
            .setRequired(false)
        ),
      new SlashCommandBuilder()
        .setName("stats")
        .setDescription("View your chat statistics"),
      new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear conversation history"),
      new SlashCommandBuilder()
        .setName("help")
        .setDescription("Show all available commands")
    ];
    
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    
    try {
      await rest.put(Routes.applicationCommands(this.client.user.id), {
        body: commands
      });
      console.log("✅ Slash commands registered!");
    } catch (error) {
      console.error("❌ Error registering slash commands:", error);
    }
  }
  
  async handleMessage(message) {
    if (message.author.bot) return;
    
    // Anti-spam and cooldown check
    if (this.isOnCooldown(message.author.id)) {
      return message.react("⏰");
    }
    
    // Update user profile
    this.updateUserProfile(message.author);
    
    const prefix = this.config.prefix;
    const mentioned = message.mentions.has(this.client.user);
    const isReplyToKillua = await this.isReplyToBot(message);
    
    let shouldRespond = false;
    let prompt = "";
    let command = "";
    
    // Command parsing
    if (message.content.startsWith(prefix)) {
      const args = message.content.slice(prefix.length).trim().split(/ +/);
      command = args.shift().toLowerCase();
      
      switch (command) {
        case "chat":
          prompt = args.join(" ");
          shouldRespond = true;
          break;
        case "roast":
          const target = args.join(" ") || message.author.username;
          prompt = `Roast this person with no mercy: ${target}. Be creative and savage.`;
          shouldRespond = true;
          break;
        case "help":
          return this.sendHelpMessage(message);
        case "stats":
          return this.sendUserStats(message);
        case "clear":
          return this.clearHistory(message);
        case "personality":
          return this.changePersonality(message, args[0]);
        case "model":
          return this.changeModel(message, args[0]);
        case "admin":
          return this.handleAdminCommands(message, args);
      }
    }
    
    // Mention or reply handling
    if (mentioned || isReplyToKillua) {
      prompt = message.content.replace(/<@!?(\d+)>/g, "").trim();
      shouldRespond = true;
    }
    
    // Random chance to respond (1% chance)
    if (!shouldRespond && Math.random() < 0.01) {
      prompt = `React to this message randomly: "${message.content}"`;
      shouldRespond = true;
    }
    
    if (shouldRespond && prompt) {
      await this.generateResponse(message, prompt);
    }
  }
  
  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName, options } = interaction;
    
    switch (commandName) {
      case "chat":
        const chatMessage = options.getString("message");
        await interaction.deferReply();
        const response = await this.getAIResponse(chatMessage, interaction.user.id);
        await interaction.editReply(response);
        break;
      case "personality":
        const personality = options.getString("mode");
        this.currentPersonality = personality;
        await interaction.reply(`🎭 Personality changed to **${personality}**!`);
        break;
      case "model":
        const model = options.getString("ai");
        this.currentModel = model;
        await interaction.reply(`🤖 Now using **${model.toUpperCase()}** model!`);
        break;
      case "roast":
        const target = options.getUser("target") || interaction.user;
        await interaction.deferReply();
        const roast = await this.getAIResponse(`Roast ${target.username} with no mercy`, interaction.user.id);
        await interaction.editReply(`${target} ${roast}`);
        break;
      case "stats":
        await this.sendUserStatsSlash(interaction);
        break;
      case "clear":
        this.conversationHistory.delete(interaction.user.id);
        await interaction.reply("🗑️ Your conversation history has been cleared!");
        break;
      case "help":
        await this.sendHelpSlash(interaction);
        break;
    }
  }
  
  async generateResponse(message, prompt) {
    try {
      await message.channel.sendTyping();
      
      // Add typing delay for realism
      setTimeout(async () => {
        const response = await this.getAIResponse(prompt, message.author.id);
        
        // Split long responses
        if (response.length > 2000) {
          const chunks = this.splitMessage(response, 2000);
          for (const chunk of chunks) {
            await message.reply(chunk);
            await this.delay(1000);
          }
        } else {
          await message.reply(response);
        }
        
        // Set cooldown
        this.setCooldown(message.author.id);
        
      }, this.config.responseDelay);
      
    } catch (error) {
      console.error("💥 AI Error:", error.response?.data || error.message);
      const errorResponses = [
        "bro the AI just flatlined 💀",
        "my brain.exe stopped working",
        "ERROR 404: Smart thoughts not found",
        "the AI gods have abandoned me 😭",
        "*mechanical screeching noises*"
      ];
      message.reply(errorResponses[Math.floor(Math.random() * errorResponses.length)]);
    }
  }
  
  async getAIResponse(prompt, userId) {
    // Get conversation history
    const history = this.conversationHistory.get(userId) || [];
    
    // Build messages array
    const messages = [
      {
        role: "system",
        content: this.personalities[this.currentPersonality]
      },
      ...history,
      { role: "user", content: prompt }
    ];
    
    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: this.models[this.currentModel],
          messages: messages,
          max_tokens: this.config.maxTokens,
          temperature: 0.9,
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.3
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            "Content-Type": "application/json"
          }
        }
      );
      
      const reply = response.data.choices[0].message.content;
      
      // Update conversation history
      history.push({ role: "user", content: prompt });
      history.push({ role: "assistant", content: reply });
      
      // Keep only last 10 messages
      if (history.length > 20) {
        history.splice(0, history.length - 20);
      }
      
      this.conversationHistory.set(userId, history);
      
      return reply;
      
    } catch (error) {
      throw error;
    }
  }
  
  async sendHelpMessage(message) {
    const embed = new EmbedBuilder()
      .setTitle("🔥 Killua Commands")
      .setDescription("Here's what I can do (if I feel like it)")
      .setColor("#FF6B6B")
      .addFields(
        { name: "💬 Chat Commands", value: "`!chat <message>` - Talk to me\n`@Killua <message>` - Mention me\nReply to my messages", inline: true },
        { name: "🔥 Fun Commands", value: "`!roast <target>` - Get roasted\n`!personality <mode>` - Change my mood\n`!model <ai>` - Switch AI brain", inline: true },
        { name: "📊 Utility", value: "`!stats` - Your chat stats\n`!clear` - Clear history\n`!help` - This menu", inline: true },
        { name: "🎭 Personalities", value: "default, wholesome, genius, chaos, therapist", inline: false },
        { name: "🤖 AI Models", value: "gpt4, claude, llama, gemini", inline: false }
      )
      .setFooter({ text: "Current: " + this.currentPersonality + " | " + this.currentModel.toUpperCase() })
      .setTimestamp();
    
    message.reply({ embeds: [embed] });
  }
  
  async sendUserStats(message) {
    const profile = this.config.userProfiles.get(message.author.id) || { messages: 0, roasts: 0, joined: new Date() };
    
    const embed = new EmbedBuilder()
      .setTitle(`📊 Stats for ${message.author.username}`)
      .setColor("#4ECDC4")
      .addFields(
        { name: "💬 Messages", value: profile.messages.toString(), inline: true },
        { name: "🔥 Roasts Received", value: profile.roasts.toString(), inline: true },
        { name: "📅 First Seen", value: profile.joined.toDateString(), inline: true }
      )
      .setThumbnail(message.author.displayAvatarURL())
      .setTimestamp();
    
    message.reply({ embeds: [embed] });
  }
  
  async welcomeUser(member) {
    const welcomeChannel = member.guild.systemChannel;
    if (!welcomeChannel) return;
    
    const welcomes = [
      `Welcome ${member}! Hope you're ready for some chaos 😈`,
      `${member} just joined the server. Another victim... I mean, friend! 💀`,
      `Look what the cat dragged in... ${member} 🙄`,
      `${member} welcome! Try not to cry when I roast you later 🔥`
    ];
    
    welcomeChannel.send(welcomes[Math.floor(Math.random() * welcomes.length)]);
  }
  
  // Utility functions
  isOnCooldown(userId) {
    const cooldown = this.config.cooldowns.get(userId);
    return cooldown && Date.now() - cooldown < 3000; // 3 second cooldown
  }
  
  setCooldown(userId) {
    this.config.cooldowns.set(userId, Date.now());
  }
  
  updateUserProfile(user) {
    const profile = this.config.userProfiles.get(user.id) || { messages: 0, roasts: 0, joined: new Date() };
    profile.messages++;
    this.config.userProfiles.set(user.id, profile);
  }
  
  async isReplyToBot(message) {
    if (!message.reference) return false;
    try {
      const refMsg = await message.channel.messages.fetch(message.reference.messageId);
      return refMsg.author.id === this.client.user.id;
    } catch {
      return false;
    }
  }
  
  splitMessage(text, maxLength) {
    const chunks = [];
    while (text.length > maxLength) {
      let chunk = text.substring(0, maxLength);
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > 0) {
        chunk = chunk.substring(0, lastSpace);
      }
      chunks.push(chunk);
      text = text.substring(chunk.length).trim();
    }
    if (text.length > 0) chunks.push(text);
    return chunks;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  clearHistory(message) {
    this.conversationHistory.delete(message.author.id);
    message.reply("🗑️ Your conversation history has been cleared!");
  }
  
  changePersonality(message, mode) {
    if (!mode || !this.personalities[mode]) {
      return message.reply(`Available personalities: ${Object.keys(this.personalities).join(", ")}`);
    }
    this.currentPersonality = mode;
    message.reply(`🎭 Personality changed to **${mode}**!`);
  }
  
  changeModel(message, model) {
    if (!model || !this.models[model]) {
      return message.reply(`Available models: ${Object.keys(this.models).join(", ")}`);
    }
    this.currentModel = model;
    message.reply(`🤖 Now using **${model.toUpperCase()}** model!`);
  }
  
  loadUserData() {
    // Load user data from file if exists
    try {
      if (fs.existsSync("userdata.json")) {
        const data = JSON.parse(fs.readFileSync("userdata.json", "utf8"));
        this.config.userProfiles = new Map(Object.entries(data));
      }
    } catch (error) {
      console.log("No existing user data found, starting fresh");
    }
  }
  
  saveUserData() {
    // Save user data to file
    const data = Object.fromEntries(this.config.userProfiles);
    fs.writeFileSync("userdata.json", JSON.stringify(data, null, 2));
  }
  
  start() {
    // Save data every 5 minutes
    setInterval(() => this.saveUserData(), 300000);
    
    // Login
    this.client.login(process.env.DISCORD_TOKEN);
  }
}

// Initialize and start the bot
const killua = new AdvancedKillua();
killua.start();

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("🛑 Shutting down...");
  killua.saveUserData();
  process.exit(0);
});
