import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import User from '../models/User.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import Follow from '../models/Follow.js';
import Message from '../models/Message.js';
import Story from '../models/Story.js';
import Report from '../models/Report.js';
import Notification from '../models/Notification.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const seedData = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/connectsphere');
    console.log('MongoDB connected for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});
    await Follow.deleteMany({});
    await Message.deleteMany({});
    await Story.deleteMany({});
    await Report.deleteMany({});
    await Notification.deleteMany({});
    console.log('Database cleared.');

    // 1. Create Users
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const users = await User.create([
      {
        username: 'admin',
        email: 'admin@connectsphere.com',
        password: hashedPassword,
        fullName: 'ConnectSphere Admin',
        role: 'admin',
        bio: 'Official platform moderator and administrator.',
        location: 'Silicon Valley, CA',
        website: 'https://connectsphere.com',
        interests: ['technology', 'business', 'news']
      },
      {
        username: 'alex_dev',
        email: 'alex@connectsphere.com',
        password: hashedPassword,
        fullName: 'Alex River',
        role: 'user',
        bio: 'Full Stack Engineer | Open Source Enthusiast | Building the future of social networks.',
        location: 'San Francisco, CA',
        website: 'https://alexriver.dev',
        interests: ['technology', 'programming', 'ai', 'webdev']
      },
      {
        username: 'sophia_art',
        email: 'sophia@connectsphere.com',
        password: hashedPassword,
        fullName: 'Sophia Chen',
        role: 'user',
        bio: 'Creative Director & Illustrator. Passionate about minimalism, color palettes, and UI design.',
        location: 'Brooklyn, NY',
        website: 'https://sophiachen.art',
        interests: ['art', 'design', 'minimalism', 'uiux']
      },
      {
        username: 'marcus_fit',
        email: 'marcus@connectsphere.com',
        password: hashedPassword,
        fullName: 'Marcus Vance',
        role: 'user',
        bio: 'Certified Personal Trainer & Nutritionist. Helping you live a healthy, high-performance life.',
        location: 'Austin, TX',
        website: 'https://vancefitness.com',
        interests: ['fitness', 'health', 'lifestyle', 'nutrition']
      },
      {
        username: 'elena_travel',
        email: 'elena@connectsphere.com',
        password: hashedPassword,
        fullName: 'Elena Rostova',
        role: 'user',
        bio: 'Travel blogger & photographer. 45 countries and counting. Capturing moments, not things.',
        location: 'Miami, FL',
        website: 'https://elenawanders.com',
        interests: ['travel', 'photography', 'lifestyle', 'nature']
      }
    ]);

    console.log('5 Mock Users created successfully!');

    const [admin, alex, sophia, marcus, elena] = users;

    // 2. Setup Following Network
    await Follow.create([
      { follower: alex._id, following: sophia._id },
      { follower: alex._id, following: elena._id },
      { follower: sophia._id, following: alex._id },
      { follower: sophia._id, following: elena._id },
      { follower: marcus._id, following: alex._id },
      { follower: marcus._id, following: elena._id },
      { follower: elena._id, following: alex._id },
      { follower: elena._id, following: sophia._id }
    ]);
    console.log('Follow connections established.');

    // 3. Create Posts
    const posts = await Post.create([
      {
        author: alex._id,
        content: 'Just launched the core architecture of #ConnectSphere using Node, Express, MongoDB, and Vanilla CSS! Check out the clean MVC layout and smart recommendation algorithms. Super thrilled to show the frontend dashboard next! #programming #webdev #technology',
        hashtags: ['connectsphere', 'programming', 'webdev', 'technology'],
        likes: [sophia._id, marcus._id, elena._id],
        sharesCount: 12
      },
      {
        author: sophia._id,
        content: 'Working on a new glassmorphism interface system. Soft glowing gradients, blurred overlays, and dynamic animations. Design should feel like frosted glass on top of a warm neon sunset. What do you think? #design #uiux #minimalism #art',
        hashtags: ['design', 'uiux', 'minimalism', 'art'],
        likes: [alex._id, elena._id],
        sharesCount: 5
      },
      {
        author: elena._id,
        content: 'Waking up to a golden sunrise in Bali. The rice terraces look absolutely mesmerizing with the morning mist. Highly recommend visiting Ubud if you need a creative reset! #travel #photography #nature',
        hashtags: ['travel', 'photography', 'nature'],
        likes: [alex._id, sophia._id, marcus._id],
        sharesCount: 18
      },
      {
        author: marcus._id,
        content: 'Consistency beats intensity every single time. You do not need to spend 3 hours in the gym. Just 45 minutes of focused resistance training, 4-5 times a week, combined with proper whole foods. Keep it simple. #fitness #health #lifestyle',
        hashtags: ['fitness', 'health', 'lifestyle'],
        likes: [alex._id],
        sharesCount: 2
      },
      {
        author: alex._id,
        content: 'Had a long discussion on AI-powered feed curation today. Our smart feed algorithm scores posts based on user interests, follow graph, social engagement, and an exponential time decay. Prevents fatigue and surface-level trends. #ai #technology',
        hashtags: ['ai', 'technology'],
        likes: [sophia._id],
        sharesCount: 4
      }
    ]);
    console.log('5 Sample Posts created successfully.');

    const [post1, post2, post3, post4, post5] = posts;

    // 4. Create Comments (including nested replies)
    const comments = await Comment.create([
      // Comments on Post 1 (Alex's WebDev launch)
      {
        post: post1._id,
        author: sophia._id,
        content: 'The MVC structure looks super solid! Can we add some custom card layouts with glowing neon borders on the UI?'
      },
      {
        post: post1._id,
        author: elena._id,
        content: 'This is awesome, Alex! Looking forward to testing the real-time notification alerts.'
      },
      // Comments on Post 2 (Sophia's Glassmorphism design)
      {
        post: post2._id,
        author: alex._id,
        content: 'Glassmorphism is gorgeous! The blur-filter effects look incredibly high-end. Let\'s combine it with high-contrast font choices.'
      }
    ]);
    console.log('Base Comments added.');

    // Add nested replies
    const [c1, c2, c3] = comments;

    await Comment.create([
      {
        post: post1._id,
        author: alex._id,
        content: 'Absolutely, Sophia! I\'m adding customizable themes so we can toggle border glow levels.',
        parentComment: c1._id
      },
      {
        post: post2._id,
        author: sophia._id,
        content: 'Yes! Planning to use Outfit or Inter font to keep it clean and legible.',
        parentComment: c3._id
      }
    ]);
    console.log('Nested Replies added.');

    // 5. Create Direct Messages
    await Message.create([
      {
        sender: alex._id,
        receiver: sophia._id,
        text: 'Hey Sophia! Did you finish the updated profile UI layout?',
        read: true,
        createdAt: new Date(Date.now() - 3600000 * 2)
      },
      {
        sender: sophia._id,
        receiver: alex._id,
        text: 'Hey Alex! Yes, just wrapping up the CSS variables for light mode styling.',
        read: true,
        createdAt: new Date(Date.now() - 3600000 * 1.8)
      },
      {
        sender: alex._id,
        receiver: sophia._id,
        text: 'Awesome, can you push it? I want to hook up the profile picture upload API.',
        read: false,
        createdAt: new Date(Date.now() - 3600000 * 0.5)
      }
    ]);
    console.log('Sample chat logs created.');

    // 6. Create Stories
    await Story.create([
      {
        author: elena._id,
        mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80'
      },
      {
        author: sophia._id,
        mediaUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=300&q=80'
      },
      {
        author: alex._id,
        mediaUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=300&q=80'
      }
    ]);
    console.log('24h Active Stories created.');

    // 7. Create Flagged Content / Admin Reports
    await Report.create([
      {
        reporter: marcus._id,
        post: post4._id,
        reason: 'This post is fine, but we are checking the admin panel reports moderation system.'
      }
    ]);
    console.log('Flagged Report created.');

    console.log('DATABASE SEEDED SUCCESSFULLY!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding database failed:', error);
    process.exit(1);
  }
};

seedData();
