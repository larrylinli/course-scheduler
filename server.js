const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync'); 
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const iconv = require('iconv-lite');

const app = express();
const port = 3000;

// 预加载的课程数据
let preloadedCourses = [];
let preScheduledCourses = []; 

// 读取预加载的课程数据
function loadInitialCourses() {
    try {
        const csvPath = path.join(__dirname, '课程信息.csv');
        console.log('Loading courses from:', csvPath);
        
        if (!fs.existsSync(csvPath)) {
            console.error('CSV file not found:', csvPath);
            return;
        }

        // 使用iconv-lite读取GB2312编码的文件
        const buffer = fs.readFileSync(csvPath);
        const fileContent = iconv.decode(buffer, 'gb2312');
        console.log('File content length:', fileContent.length);

        const records = parse(fileContent, { 
            columns: true,
            skip_empty_lines: true,
            trim: true
        });
        
        console.log('Parsed records count:', records.length);
        
        // 清空现有数据
        preloadedCourses = [];
        preScheduledCourses = [];
        
        // 按课程代码和类型分组课程记录
        const courseGroups = {};
        records.forEach((record, index) => {
            // 记录原始数据格式
            if (index === 0) {
                console.log('Sample record:', record);
            }

            // 跳过空记录
            if (!record.courseCode || !record.courseName || !record.courseType) {
                console.log('Skipping empty record:', record);
                return;
            }

            // 格式化日期和时间
            const formattedDate = formatDate(record.lessonDate);
            const formattedStartTime = formatTime(record.sectionBeginTime);
            const formattedEndTime = formatTime(record.sectionEndTime);

            if (!formattedDate || !formattedStartTime || !formattedEndTime) {
                console.log('Invalid date/time format:', {
                    date: record.lessonDate,
                    start: record.sectionBeginTime,
                    end: record.sectionEndTime
                });
                return;
            }

            const courseKey = `${record.courseCode}_${record.courseType}`;
            if (!courseGroups[courseKey]) {
                courseGroups[courseKey] = {
                    code: record.courseCode,
                    name: record.courseName,
                    nameEn: record.courseNameEn || '',
                    teacher: record.facultyName || '',
                    credits: parseFloat(record.totalCredit) || 0,
                    totalHour: parseFloat(record.totalHour) || 0,
                    courseType: record.courseType,
                    language: record.language || '中文',
                    maxStudents: record.maxNum === '非选课' ? 0 : (parseInt(record.maxNum) || 0),
                    classMode: record.iClassMode || '',
                    sessions: []
                };
            }
            
            // 只有当有日期和时间信息时才添加课程时间段
            if (formattedDate && formattedStartTime && formattedEndTime) {
                courseGroups[courseKey].sessions.push({
                    date: formattedDate,
                    startTime: formattedStartTime,
                    endTime: formattedEndTime,
                    classroom: record.classRoomName || '未指定'
                });
            }
        });
        
        // 将分组后的课程添加到相应列表
        Object.values(courseGroups).forEach(course => {
            // 确保课程有时间安排
            if (course.sessions.length === 0) {
                console.log(`Skipping course without sessions: ${course.name}`);
                return;
            }

            if (course.courseType === '已排课') {
                preScheduledCourses.push(course);
            } else if (course.courseType === '春选课') {
                preloadedCourses.push(course);
            }
        });
        
        console.log(`Loaded ${preloadedCourses.length} elective courses and ${preScheduledCourses.length} pre-scheduled courses`);
        
        // 输出示例数据以供调试
        if (preScheduledCourses.length > 0) {
            console.log('Sample scheduled course:', {
                name: preScheduledCourses[0].name,
                sessions: preScheduledCourses[0].sessions
            });
        }
    } catch (error) {
        console.error('Error loading initial courses:', error);
    }
}

// 格式化日期为 YYYY-MM-DD 格式
function formatDate(dateStr) {
    if (!dateStr) return null;
    
    // 尝试解析日期格式
    const match = dateStr.match(/(\d{4})[-/]?(\d{1,2})[-/]?(\d{1,2})/);
    if (!match) return null;
    
    const [_, year, month, day] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

// 格式化时间为 HH:mm:ss 格式
function formatTime(timeStr) {
    if (!timeStr) return null;
    
    // 尝试解析时间格式
    const match = timeStr.match(/(\d{1,2}):?(\d{2})/);
    if (!match) return null;
    
    const [_, hours, minutes] = match;
    return `${hours.padStart(2, '0')}:${minutes}:00`;
}

// 配置文件上传
const upload = multer({ dest: 'uploads/' });

// 中间件
app.use(express.static('public'));
app.use(bodyParser.json());

// API路由
app.get('/api/courses', (req, res) => {
    try {
        // 确保数据已加载
        if (preloadedCourses.length === 0 && preScheduledCourses.length === 0) {
            loadInitialCourses();
        }
        
        res.json({
            electiveCourses: preloadedCourses,
            scheduledCourses: preScheduledCourses
        });
    } catch (error) {
        console.error('Error in /api/courses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const buffer = fs.readFileSync(req.file.path);
        const fileContent = iconv.decode(buffer, 'gb2312');
        
        const records = parse(fileContent, { 
            columns: true,
            skip_empty_lines: true
        });

        const courses = records.map(record => ({
            code: record.courseCode,
            name: record.courseName,
            nameEn: record.courseNameEn,
            teacher: record.facultyName,
            credits: parseFloat(record.totalCredit),
            totalHour: parseFloat(record.totalHour),
            classroom: record.classRoomName,
            courseType: record.courseType,
            language: record.language,
            startTime: record.sectionBeginTime,
            endTime: record.sectionEndTime,
            date: record.lessonDate,
            maxStudents: parseInt(record.maxNum),
            classMode: record.iClassMode
        }));

        res.json({ courses });

        // 删除上传的文件
        fs.unlinkSync(req.file.path);
    } catch (error) {
        console.error('Error processing uploaded file:', error);
        res.status(400).json({ error: 'Error processing CSV file' });
    }
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
                    conflictSlots: getConflictDetails(courses[i], courses[j])
                });
            }
        }
    }

    const conflictRate = calculateConflictRate(conflicts.length, courses.length);
    res.json({ conflicts, conflictRate });
});

// 辅助函数
function hasTimeConflict(course1, course2) {
    if (course1.date !== course2.date) return false;
    
    const start1 = new Date(`${course1.date}T${course1.startTime}`);
    const end1 = new Date(`${course1.date}T${course1.endTime}`);
    const start2 = new Date(`${course2.date}T${course2.startTime}`);
    const end2 = new Date(`${course2.date}T${course2.endTime}`);

    return (start1 < end2 && start2 < end1);
}

function getConflictDetails(course1, course2) {
    return `${course1.date} ${course1.startTime}-${course1.endTime}`;
}

function calculateConflictRate(conflictsCount, totalCourses) {
    if (totalCourses <= 1) return 0;
    const maxPossibleConflicts = (totalCourses * (totalCourses - 1)) / 2;
    return (conflictsCount / maxPossibleConflicts) * 100;
}

// 启动时加载课程数据
loadInitialCourses();

// 启动服务器
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
