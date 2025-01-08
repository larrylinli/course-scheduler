const express = require('express');
const multer = require('multer');
const csv = require('csv-parse');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

// 配置文件上传
const upload = multer({ dest: 'uploads/' });

// 中间件
app.use(express.static('public'));
app.use(bodyParser.json());

// 路由
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const parser = csv.parse({ columns: true }, (err, records) => {
        if (err) {
            return res.status(400).json({ error: 'Invalid CSV file' });
        }

        // 处理课程数据
        const courses = records.map(record => ({
            code: record['课程代码'],
            name: record['课程名称'],
            teacher: record['教师'],
            credits: parseFloat(record['学分']),
            timeSlots: record['时间段'],
            classroom: record['教室']
        }));

        res.json({ courses });

        // 删除上传的文件
        fs.unlink(req.file.path, err => {
            if (err) console.error('Error deleting file:', err);
        });
    });

    fs.createReadStream(req.file.path).pipe(parser);
});

// 检查课程冲突
app.post('/api/check-conflicts', (req, res) => {
    const courses = req.body.courses;
    const conflicts = [];

    for (let i = 0; i < courses.length; i++) {
        for (let j = i + 1; j < courses.length; j++) {
            if (hasTimeConflict(courses[i], courses[j])) {
                conflicts.push({
                    course1: courses[i],
                    course2: courses[j],
                    conflictSlots: getConflictSlots(courses[i], courses[j])
                });
            }
        }
    }

    const conflictRate = calculateConflictRate(conflicts.length, courses.length);
    res.json({ conflicts, conflictRate });
});

// 辅助函数
function hasTimeConflict(course1, course2) {
    // TODO: 实现时间冲突检测逻辑
    return false;
}

function getConflictSlots(course1, course2) {
    // TODO: 实现获取具体冲突时间段的逻辑
    return [];
}

function calculateConflictRate(conflictsCount, totalCourses) {
    if (totalCourses <= 1) return 0;
    const maxPossibleConflicts = (totalCourses * (totalCourses - 1)) / 2;
    return (conflictsCount / maxPossibleConflicts) * 100;
}

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
