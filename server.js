const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// بارگذاری یا ساخت دیتابیس اولیه
function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const initialDb = {
            adminConfig: {
                secretCode: "arash",
                password: "admin"
            },
            users: [],
            activeAdmins: 0
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2));
        return initialDb;
    }
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {
            adminConfig: { secretCode: "arash", password: "admin" },
            users: [],
            activeAdmins: 0
        };
    }
}

function saveDatabase(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// REST API - ورود ادمین با محدودیت حداکثر ۲ ادمین همزمان
app.post('/api/admin/login', (req, res) => {
    const { secretCode, password } = req.body;
    let db = loadDatabase();

    if (db.activeAdmins >= 2) {
        return res.status(403).json({ error: 'ظرفیت ورود ادمین‌ها تکمیل است (حداکثر ۲ ادمین همزمان).' });
    }

    if (secretCode === db.adminConfig.secretCode && password === db.adminConfig.password) {
        db.activeAdmins += 1;
        saveDatabase(db);
        res.json({ success: true });
    } else {
        res.status(401).json({ error: 'کد مخفی یا رمز عبور ادمین اشتباه است.' });
    }
});

// خروج ادمین
app.post('/api/admin/logout', (req, res) => {
    let db = loadDatabase();
    if (db.activeAdmins > 0) {
        db.activeAdmins -= 1;
        saveDatabase(db);
    }
    res.json({ success: true });
});

// ایجاد کاربر جدید توسط ادمین
app.post('/api/admin/create-user', (req, res) => {
    const { username, password, configLink, gb, days, userCount } = req.body;
    let db = loadDatabase();

    if (db.users.some(u => u.username === username)) {
        return res.status(400).json({ error: 'این نام کاربری قبلاً ثبت شده است.' });
    }

    const newUser = {
        id: Date.now().toString(),
        username,
        password,
        isLocked: false,
        configLink,
        gb: gb || '۵۰ گیگابایت',
        days: days || '۳۰ روز',
        userCount: userCount || '۲ کاربره'
    };

    db.users.push(newUser);
    saveDatabase(db);
    res.json({ success: true, user: newUser });
});

// لیست کاربران برای ادمین
app.get('/api/admin/users', (req, res) => {
    let db = loadDatabase();
    res.json(db.users);
});

// تغییر وضعیت قفل یا حذف کاربر
app.post('/api/admin/user-action', (req, res) => {
    const { userId, action } = req.body;
    let db = loadDatabase();

    if (action === 'delete') {
        db.users = db.users.filter(u => u.id !== userId);
    } else if (action === 'toggleLock') {
        const user = db.users.find(u => u.id === userId);
        if (user) user.isLocked = !user.isLocked;
    }

    saveDatabase(db);
    res.json({ success: true });
});

// بروزرسانی اطلاعات ادمین
app.post('/api/admin/update-credentials', (req, res) => {
    const { newSecretCode, newPassword } = req.body;
    let db = loadDatabase();

    if (newSecretCode) db.adminConfig.secretCode = newSecretCode;
    if (newPassword) db.adminConfig.password = newPassword;

    saveDatabase(db);
    res.json({ success: true });
});

// ورود کاربر
app.post('/api/user/login', (req, res) => {
    const { username, password } = req.body;
    let db = loadDatabase();

    const user = db.users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور نادرست است.' });
    }
    if (user.isLocked) {
        return res.status(403).json({ error: 'حساب کاربری شما توسط مدیریت مسدود شده است.' });
    }

    res.json({ success: true, user });
});

// تغییر رمز عبور کاربر
app.post('/api/user/change-password', (req, res) => {
    const { username, newPassword } = req.body;
    let db = loadDatabase();

    const user = db.users.find(u => u.username === username);
    if (user) {
        user.password = newPassword;
        saveDatabase(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'کاربر یافت نشد.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
