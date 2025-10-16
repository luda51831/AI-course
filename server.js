require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Де будуть зберігатися фото
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); 
  },
  filename: function (req, file, cb) {
    const decodedName = Buffer.from(file.originalname, 'binary').toString('utf8');
    const ext = path.extname(decodedName);
    const baseName = path.basename(decodedName, ext);
  
    // Зберігаємо файл з повною назвою
    const safeName = `${baseName.replace(/[<>:"/\\|?*]+/g, '_')}-${Date.now()}${ext}`;
    cb(null, safeName);
  }
  
  
});
app.use('/uploads', express.static('uploads'));

const upload = multer({ storage });

import express from "express";
import cors from "cors";


app.use(cors({
  origin: "https://ai-course-sm7i.onrender.com", // 👈 твій фронтенд
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use("/api", yourRoutes);


  const PORT = process.env.PORT || 3000;
  const SECRET_KEY = process.env.SECRET_KEY;
  
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
  const ADMIN_PASS = process.env.ADMIN_PASS;
  
  mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));
  
// Схеми
const User = mongoose.model('User', new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  avatarUrl: String,
  courseEndDate: Date,
  progress: { type: Map, of: Number, default: {} },
  language: { type: String, enum: ['uk', 'en'], default: 'uk' } 
}));


const Lesson = mongoose.model('Lesson', new mongoose.Schema({
  lessonId: { type: String },
  lessonNumber: { type: Number, required: true },
  title: String,
  description: String,
  videoUrl: String,
  openDay: { type: Number, min: 1, max: 31 },
  closeDay: { type: Number, min: 1, max: 31 },
  homework: String,
  pinnedComment: String,
  language: { type: String, enum: ['uk', 'en'], default: 'uk' }
}));


const HomeworkSchema = new mongoose.Schema({
  userEmail: String,
  lessonNumber: String,
  filename: String,
  storedFilename: String,
  path: String,
  comment: String,
  adminComment: String,
  isAdminCommentRead: { type: Boolean, default: true },
  uploadedAt: { type: Date, default: Date.now, expires: 37 * 24 * 60 * 60 }, // 37 днів
  language: { type: String, enum: ['uk', 'en'], default: 'uk' }
});

const Homework = mongoose.model('Homework', HomeworkSchema);

// Мідлвари
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
}

function adminMiddleware(req, res, next) {
  if (!req.user.isAdmin) return res.status(403).json({ message: 'Only admin' });
  next();
}

// Отримати всіх користувачів (для адміна)
app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    // Включаємо passwordHash для адміна
    const users = await User.find({}, 'name email avatarUrl language courseEndDate passwordHash').lean();
    res.json(users);
  } catch (err) {
    console.error('Помилка отримання користувачів:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

app.put('/api/users/:id', authMiddleware, adminMiddleware, upload.single('photo'), async (req, res) => {
  try {
    const { name, email, password, language } = req.body;
    const photoFile = req.file;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (language) user.language = language;
    if (password) user.passwordHash = await bcrypt.hash(password, 10);
    if (photoFile) user.avatarUrl = `/uploads/${photoFile.filename}`;

    await user.save();
    res.json({ message: 'Користувача оновлено', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

app.delete('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });

    // Видаляємо аватарку, якщо є
    if (user.avatarUrl) {
      const filePath = path.join(__dirname, user.avatarUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json({ message: 'Користувача видалено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});


// Реєстрація
app.post('/api/register', upload.single('photo'), async (req, res) => {
  try {
    const { name, email, password, language } = req.body;
    const photoFile = req.file;

    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Всі поля обовʼязкові' });
    }

    if (email === ADMIN_EMAIL) 
      return res.status(400).json({ message: 'Цей email зарезервовано' });

    const existing = await User.findOne({ email });
    if (existing) 
      return res.status(400).json({ message: 'Користувач вже існує' });

    const passwordHash = await bcrypt.hash(password, 10);
    const courseEnd = new Date(new Date().getFullYear(), new Date().getMonth(), 28);

    const newUser = new User({
      name,
      email,
      passwordHash,
      courseEndDate: courseEnd,
      avatarUrl: photoFile ? `/uploads/${photoFile.filename}` : null,
      language: language || 'uk'
    });
    

    await newUser.save();

    res.json({ message: 'Зареєстровано' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});


// Логін
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASS) {
    const token = jwt.sign({ email, isAdmin: true }, SECRET_KEY, { expiresIn: '1d' });
    return res.json({ token, isAdmin: true, redirect: '/admin.html' });
  }

  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(400).json({ message: 'Неправильні дані' });
  }

  const token = jwt.sign({ email, isAdmin: false }, SECRET_KEY, { expiresIn: '1d' });
  res.json({ token, isAdmin: false, redirect: '/' });
});

app.get('/profile', authMiddleware, (req, res) => {
  if (req.user.isAdmin) {
    res.redirect('/admin.html');
  } else {
    res.redirect('/profile.html');
  }
});

app.get('/api/users/:email', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });
    res.json({
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});


// Завантаження відео (multer)
const videoStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads/videos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const uploadVideo = multer({ storage: videoStorage });

const homeworkStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'uploads/homeworks');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    let originalName = file.originalname;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {}

    // Заборонені символи у файлових системах
    const safeName = originalName.replace(/[<>:"/\\|?*]+/g, '_');

    cb(null, safeName);
  }
});

const uploadHomework = multer({ storage: homeworkStorage });



// Додати урок
app.post('/api/admin/lesson', authMiddleware, adminMiddleware, uploadVideo.single('video'), async (req, res) => {
  try {
    const { lessonId, lessonNumber, title, description, homework, pinnedComment, openDay, closeDay, language } = req.body;

    if (!lessonNumber || !title || !req.file) {
      return res.status(400).json({ message: 'Номер уроку, назва та відео обов’язкові' });
    }

    const lessonLang = language || 'uk';

    // 🔹 Перевірка унікальності комбінації (номер + мова)
    const existingLesson = await Lesson.findOne({
      lessonNumber: Number(lessonNumber),
      language: lessonLang
    });

    if (existingLesson) {
      return res.status(400).json({ message: `Урок з номером ${lessonNumber} і мовою ${lessonLang} вже існує` });
    }

    // 🔹 Автоматично створюємо lessonId, якщо не заданий
    const lessonIdNum = lessonId || `lesson_${Date.now()}`;
    const videoUrl = '/videos/' + req.file.filename;

    await new Lesson({
      lessonId: lessonIdNum,
      lessonNumber: Number(lessonNumber),
      title,
      description,
      videoUrl,
      homework,
      pinnedComment,
      openDay: Number(openDay),
      closeDay: Number(closeDay),
      language: lessonLang
    }).save();

    res.json({ message: 'Урок додано успішно ✅' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка при додаванні уроку' });
  }
});



// Видалення уроку
app.delete('/api/admin/lesson/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const lesson = await Lesson.findByIdAndDelete(req.params.id);
  if (lesson && lesson.videoUrl) {
    const filePath = path.join(__dirname, 'uploads', lesson.videoUrl.replace('/videos/', ''));
    fs.unlink(filePath, () => {});
  }
  res.json({ message: 'Урок видалено' });
});

// Отримати уроки
app.get('/api/lessons', authMiddleware, async (req, res) => {
  const lang = req.query.lang || 'uk'; 
  const today = new Date().getDate();

  const lessons = await Lesson.find({ language: lang }).sort({ lessonNumber: 1 });

  const lessonsWithStatus = lessons.map(l => {
    const isOpen = today >= l.openDay && today <= l.closeDay;
    return {
      ...l.toObject(),
      isOpen
    };
  });

  res.json(lessonsWithStatus);
});


app.get('/api/admin/lessons', authMiddleware, adminMiddleware, async (req, res) => {
  const lessons = await Lesson.find({}).sort({ lessonNumber: 1 });

  res.json(lessons);
});


app.post('/api/progress', authMiddleware, async (req, res) => {
  try {
    const { lessonNumber, percent } = req.body;

    if (typeof lessonNumber === 'undefined' || typeof percent === 'undefined') {
      return res.status(400).json({ message: 'lessonNumber і percent потрібні' });
    }

    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: 'Користувач не знайдений' });

    if (!user.progress) user.progress = {};

    const key = lessonNumber.toString();
    const newPercent = Number(percent);
    
    const currentPercent = user.progress.get(key) || 0;
    
    if (currentPercent < newPercent) {
      user.progress.set(key, newPercent);
      user.markModified('progress');
      await user.save();
    }    
    res.json({ message: 'Прогрес оновлено' });
  } catch (err) {
    console.error('Помилка оновлення прогресу:', err);
    res.status(500).json({ message: 'Помилка сервера при оновленні прогресу', error: err.message });
  }
});


app.get('/api/progress', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(404).json({ error: 'Користувач не знайдений' });
    }

    const progressMap = user.progress || new Map();
    const progressObj = {};
    
    progressMap.forEach((value, key) => {
      progressObj[key] = value;
    });
    
    res.json(progressObj);
    
  } catch (err) {
    res.status(500).json({ error: 'Помилка сервера' });
  }
});



app.post('/api/homework', authMiddleware, uploadHomework.single('file'), async (req, res) => {
  try {
    const { lessonNumber, comment, language } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Файл не знайдено' });

    const user = await User.findOne({ email: req.user.email });
    const hwLanguage = language || lesson?.language || user?.language || 'uk';

    let originalName = file.originalname;
    try {
      originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    } catch (e) {}

    const homeworkData = {
      userEmail: req.user.email,
      lessonNumber,
      filename: originalName,
      storedFilename: file.filename,
      path: file.path,
      comment,
      uploadedAt: new Date(),
      language: hwLanguage
    };

    const created = await Homework.create(homeworkData);

    res.json({
      message: 'Домашка прийнята',
      homework: created
    });
  } catch (err) {
    console.error('Помилка при завантаженні домашки:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});


app.get('/download/homework/:id', authMiddleware, async (req, res) => {
  try {
    const hw = await Homework.findById(req.params.id);
    if (!hw) return res.status(404).json({ message: 'ДЗ не знайдено' });

    let filePath = hw.path;
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(__dirname, hw.path);
    }

    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Файл відсутній на сервері' });

    const originalName = hw.filename || 'homework';
    const encodedName = encodeURIComponent(originalName);

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Type', 'application/octet-stream');

    res.sendFile(filePath);
  } catch (err) {
    console.error('Помилка при віддачі файлу:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});






  app.get('/api/profile/progress', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    // Прогрес користувача
    const progress = user.progress || new Map();

    const calculateProgress = async (lang) => {
      const lessons = await Lesson.find({ language: lang }).sort({ lessonNumber: 1 });

      const totalLessons = lessons.length;
      if (totalLessons === 0) {
        return { totalLessons: 0, progress: {}, overallProgress: 0 };
      }

      let sumProgress = 0;
      const progressObj = {};

      lessons.forEach(lesson => {
        const key = lesson.lessonNumber.toString();
        const percent = progress.has(key) ? progress.get(key) : 0;
        progressObj[lesson.lessonNumber] = percent;
        sumProgress += percent;
      });

      const overallProgress = Math.round(sumProgress / totalLessons);

      return { totalLessons, progress: progressObj, overallProgress };
    };

    const ukProgress = await calculateProgress('uk');
    const enProgress = await calculateProgress('en');

    res.json({
      uk: ukProgress,
      en: enProgress
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});


const crypto = require('crypto');

app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    if (!user) return res.status(404).json({ message: 'Користувача не знайдено' });

    res.json({
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || 'https://www.gravatar.com/avatar/?d=identicon&s=200'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

  
  app.delete('/api/homework/:id', authMiddleware, async (req, res) => {
    try {
      const hw = await Homework.findOne({ _id: req.params.id, userEmail: req.user.email });
      if (!hw) return res.status(404).json({ message: 'ДЗ не знайдено' });
  
      // Видаляємо файл
      if (hw.path && fs.existsSync(hw.path)) fs.unlinkSync(hw.path);
  
      await Homework.deleteOne({ _id: hw._id });
  
      res.json({ message: 'ДЗ видалено' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Помилка сервера' });
    }
  });

  app.put('/api/homework/:id', authMiddleware, async (req, res) => {
    try {
      const { comment } = req.body;
      const hw = await Homework.findOne({ _id: req.params.id, userEmail: req.user.email });
      if (!hw) return res.status(404).json({ message: 'ДЗ не знайдено' });
  
      hw.comment = comment;
      await hw.save();
  
      res.json({ message: 'Коментар оновлено', homework: hw });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Помилка сервера' });
    }
  });

  app.put('/api/homework/:id/read', authMiddleware, async (req, res) => {
    try {
      const hw = await Homework.findOne({ _id: req.params.id, userEmail: req.user.email });
      if (!hw) return res.status(404).json({ message: 'ДЗ не знайдено' });
  
      hw.isAdminCommentRead = true;
      await hw.save();
  
      res.json({ message: 'Позначено як прочитане' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Помилка сервера' });
    }
  });
  

// Отримати домашки користувача
app.get('/api/homework', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const homework = await Homework.find({ userEmail }).sort({ uploadedAt: -1 });
    res.json(homework);
  } catch (err) {
    console.error('Homework fetch error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});


// Адмін додає коментар до домашки
app.put('/api/admin/homework/:id/comment', authMiddleware, adminMiddleware, async (req, res) => {
  const id = req.params.id;
  const { adminComment } = req.body;

  if (typeof adminComment !== 'string') {
    return res.status(400).json({ message: 'Невірний формат коментаря' });
  }

  try {
    const hw = await Homework.findByIdAndUpdate(
      id,
      { adminComment: adminComment, isAdminCommentRead: false },
      { new: true }
    );

    if (!hw) {
      return res.status(404).json({ message: 'Домашка не знайдена' });
    }

    res.json({ message: 'Коментар оновлено', homework: hw });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Повертає список домашок з новими коментарями від адміна
app.get('/api/homework/notifications', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const notifications = await Homework.find({
      userEmail,
      adminComment: { $exists: true, $ne: '' },
      isAdminCommentRead: false
    }).sort({ uploadedAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера при отриманні сповіщень' });
  }
});

app.put('/api/homework/:id/read', authMiddleware, async (req, res) => {
  try {
    const hw = await Homework.findOne({ _id: req.params.id, userEmail: req.user.email });
    if (!hw) return res.status(404).json({ message: 'ДЗ не знайдено' });

    hw.isAdminCommentRead = true;
    await hw.save();

    res.json({ message: 'Позначено як прочитане' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Отримати домашки для конкретного уроку
app.get('/api/homework/:lessonNumber', authMiddleware, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const lessonNumber = req.params.lessonNumber;
    const homeworks = await Homework.find({ userEmail, lessonNumber }).sort({ uploadedAt: -1 });
    res.json(homeworks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});

// Отримати всі домашки (для адміна)
app.get('/api/admin/homework', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const homework = await Homework.find({}).sort({ uploadedAt: -1 });

    const lessons = await Lesson.find({});
    const lessonsMap = new Map();

    // Збережемо одночасно мову і назву уроку
    lessons.forEach(l => {
      const key = `${l.lessonNumber}_${l.language}`;
      lessonsMap.set(key, { language: l.language, title: l.title });
    });

    const homeworkWithLang = homework.map(hw => {
      let lang = '—';
      let title = 'Невідомий урок';
      const ukKey = `${hw.lessonNumber}_uk`;
      const enKey = `${hw.lessonNumber}_en`;

      if (hw.language && lessonsMap.has(`${hw.lessonNumber}_${hw.language}`)) {
        lang = hw.language;
        title = lessonsMap.get(`${hw.lessonNumber}_${hw.language}`).title;
      } else {
        lang = 'uk'; // за замовчуванням
        title = lessonsMap.get(`${hw.lessonNumber}_uk`)?.title || 'Невідомий урок';
      }      
      

      return {
        ...hw.toObject(),
        language: lang,
        lessonTitle: title
      };
    });

    res.json(homeworkWithLang);
  } catch (err) {
    console.error('Admin homework fetch error:', err);
    res.status(500).json({ message: 'Помилка сервера' });
  }
});



// 🧹 Автоматичне очищення старих домашок (раз на добу)
setInterval(async () => {
  try {
    const limitDate = new Date(Date.now() - 37 * 24 * 60 * 60 * 1000); // 37 днів тому
    const oldHomeworks = await Homework.find({ uploadedAt: { $lt: limitDate } });

    for (const hw of oldHomeworks) {
      if (hw.path && fs.existsSync(hw.path)) {
        fs.unlinkSync(hw.path);
        console.log(`🗑 Видалено файл: ${hw.path}`);
      }
      await Homework.deleteOne({ _id: hw._id });
    }

    if (oldHomeworks.length > 0) {
      console.log(`✅ Видалено ${oldHomeworks.length} старих домашок`);
    }
  } catch (err) {
    console.error('❌ Помилка очищення старих домашок:', err);
  }
}, 24 * 60 * 60 * 1000); // запускається раз на 24 години

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/choise.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

//app.use('/homeworks', express.static(path.join(__dirname, 'uploads')));


// Статичні файли
app.use('/videos', express.static(path.join(__dirname, 'uploads/videos')));
app.use('/homeworks', express.static(path.join(__dirname, 'uploads/homeworks')));
app.use(express.static(path.join(__dirname, 'public')));



// SPA fallback
app.get('*', (req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path.startsWith('/videos') ||
    req.path.startsWith('/homeworks')
  ) return next();

  res.sendFile(path.join(__dirname, 'public/choise.html'));
});

// Запуск сервера
app.listen(PORT, () => console.log(`✅ Сервер запущено: http://localhost:${PORT}`));
