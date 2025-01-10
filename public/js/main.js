// 全局变量
let calendar;
let preloadedCourses = [];
let selectedCourses = [];
let scheduledCourses = [];

// 添加显示模式状态
let showAllCourses = true;

// 初始化日历
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'zh-cn',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek'
        },
        events: [],
        eventClick: function(info) {
            console.log('Clicked event:', info.event);
        },
        initialDate: '2025-02-01',
        displayEventTime: true,
        eventDisplay: 'block',
        eventTimeFormat: {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }
    });
    calendar.render();
}

// 合并相同课程的会话
function mergeCoursesByLessonClass(courses) {
    if (!Array.isArray(courses)) {
        console.error('Invalid courses data:', courses);
        return [];
    }
    
    console.log('Merging courses, input:', courses);
    const mergedMap = new Map();
    
    // 过滤和合并课程
    courses.forEach(course => {
        // 跳过没有lessonClassShortName的课程
        if (!course || !course.lessonClassShortName) return;
        
        // 获取基础课程代码（移除iclass后缀）
        const baseKey = course.lessonClassShortName.replace('iclass', '');
        const key = course.isOnline ? `${baseKey}iclass` : baseKey;
        
        if (!mergedMap.has(key)) {
            // 创建新的合并课程对象
            mergedMap.set(key, {
                ...course,
                sessions: [...(course.sessions || [])],
                hasIclass: course.iclassMode ? true : false,
                isOnline: course.isOnline || false
            });
        } else {
            // 更新现有课程
            const existing = mergedMap.get(key);
            if (course.sessions) {
                existing.sessions = [...existing.sessions, ...course.sessions];
            }
            if (course.iclassMode) {
                existing.hasIclass = true;
            }
        }
    });
    
    const result = Array.from(mergedMap.values());
    console.log('Merged result:', result);
    return result;
}

// 加载课程数据
async function loadCourses() {
    console.log('Loading courses...');
    try {
        const response = await fetch('/api/courses');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('Raw courses data:', data);
        
        // 设置课程数据
        preloadedCourses = Array.isArray(data.electiveCourses) ? data.electiveCourses : [];
        scheduledCourses = Array.isArray(data.scheduledCourses) ? data.scheduledCourses : [];
        
        console.log('Loaded courses:', {
            elective: preloadedCourses.length,
            scheduled: scheduledCourses.length
        });
        
        // 更新界面
        updateCourseList();
        updateCalendarEvents();
        updateStatistics();
    } catch (error) {
        console.error('Error loading courses:', error);
    }
}

// 更新课程列表
function updateCourseList() {
    const courseListElement = document.getElementById('courseList');
    if (!courseListElement) return;

    // 只显示可选课程
    const mergedCourses = mergeCoursesByLessonClass(preloadedCourses);
    console.log('Merged courses for list:', mergedCourses.length);

    courseListElement.innerHTML = '';
    mergedCourses.forEach(course => {
        // 检查当前课程的选中状态和模式
        const selectedCourse = selectedCourses.find(selected => 
            selected.lessonClassShortName.replace('iclass', '') === course.lessonClassShortName
        );
        const isSelected = !!selectedCourse;
        const isOnlineSelected = selectedCourse?.isOnline;
        
        const courseElement = document.createElement('div');
        courseElement.className = `course-item ${isSelected ? 'selected' : ''}`;
        
        // 获取课程节数
        const sessionCount = course.sessions ? course.sessions.length : 0;
        
        // 完整的时间信息（用于悬停显示）
        const fullTimeInfo = course.sessions ? course.sessions.map(session =>
            `${session.date} ${session.startTime.substring(0, 5)}-${session.endTime.substring(0, 5)} ${session.classroom}`
        ).join('\n') : '';

        // 判断是否是iclass课程（mode=4）
        const isIclassCourse = course.classMode === '4';
        
        courseElement.innerHTML = `
            <div class="course-header">
                <div class="course-title">
                    <span class="course-name">${course.name}</span>
                    <span class="course-code">${course.lessonClassShortName}</span>
                    ${course.classMode === '4' ? '<span class="iclass-icon">🌐</span>' : ''}
                </div>
                <div class="d-flex align-items-center">
                    <div class="course-teacher me-2">${course.teacher || ''}</div>
                    <div class="course-language text-muted small">（${course.language || '未指定'}）</div>
                </div>
            </div>
            <div class="course-info">
                <div class="course-meta">
                    <span class="course-credits">${course.credits}学分/${course.totalHour}学时</span>
                    <span class="course-sessions" title="${fullTimeInfo}">${sessionCount}次课</span>
                </div>
                <div class="course-actions">
                    ${isIclassCourse ? `
                        <div class="btn-group btn-group-sm" role="group">
                            <button class="btn ${isSelected && !isOnlineSelected ? 'btn-primary' : 'btn-outline-primary'} select-offline-btn">线下</button>
                            <button class="btn ${isSelected && isOnlineSelected ? 'btn-primary' : 'btn-outline-primary'} select-online-btn">线上</button>
                        </div>
                    ` : `
                        <button class="select-btn ${isSelected ? 'selected' : ''}">${isSelected ? '退选' : '选课'}</button>
                    `}
                </div>
            </div>
        `;

        // 添加事件监听
        if (isIclassCourse) {
            const offlineBtn = courseElement.querySelector('.select-offline-btn');
            const onlineBtn = courseElement.querySelector('.select-online-btn');
            
            offlineBtn.addEventListener('click', () => toggleCourseSelection(course, false));
            onlineBtn.addEventListener('click', () => toggleCourseSelection(course, true));
        } else {
            courseElement.addEventListener('click', () => toggleCourseSelection(course, false));
        }

        courseListElement.appendChild(courseElement);
    });
}

// 修改选课切换函数以支持在线模式
function toggleCourseSelection(course, isOnline = false) {
    console.log('Toggling course selection:', course, 'isOnline:', isOnline);
    
    // 创建课程副本，添加在线标记
    const courseWithMode = {
        ...course,
        isOnline: isOnline,
        // 如果是在线模式，修改lessonClassShortName
        lessonClassShortName: isOnline ? `${course.lessonClassShortName}iclass` : course.lessonClassShortName
    };
    
    // 查找现有选课（同时考虑线上和线下版本）
    const baseCode = course.lessonClassShortName.replace('iclass', '');
    const index = selectedCourses.findIndex(selected => 
        selected.lessonClassShortName.replace('iclass', '') === baseCode
    );
    
    if (index === -1) {
        selectedCourses.push(courseWithMode);
        console.log('Course added to selection');
    } else {
        selectedCourses.splice(index, 1);
        console.log('Course removed from selection');
    }
    
    updateCalendarEvents();
    updateCourseList();
    updateStatistics();
    checkAllConflicts();
    loadCourseData();
}

// 更新统计信息
function updateStatistics() {
    // 初始化统计数据
    const stats = {
        selectedCount: selectedCourses.length,
        credits: 0,
        hours: 0,
        conflicts: calculateTotalConflicts()
    };

    // 计算已选课程的统计
    selectedCourses.forEach(course => {
        stats.credits += parseFloat(course.credits) || 0;
        stats.hours += parseInt(course.totalHour) || 0;
    });

    // 统计已排课程（根据courseType）
    const scheduledCoursesMap = new Map();
    scheduledCourses.forEach(course => {
        if (course.courseType === '已排课' && course.lessonClassShortName) {
            scheduledCoursesMap.set(course.lessonClassShortName, course);
        }
    });

    // 添加已排课程的统计
    scheduledCoursesMap.forEach(course => {
        stats.credits += parseFloat(course.credits) || 0;
        stats.hours += parseInt(course.totalHour) || 0;
    });

    // 更新总课程数
    stats.selectedCount += scheduledCoursesMap.size;

    // 更新显示
    document.getElementById('selectedCourseCount').textContent = stats.selectedCount ;
    document.getElementById('totalCredits').textContent = stats.credits.toFixed(1) ;
    document.getElementById('totalHours').textContent = stats.hours ;
    document.getElementById('conflictCount').textContent = stats.conflicts ;
}

// 检查所有课程冲突
function checkAllConflicts() {
    const conflicts = [];
    const courses = [...selectedCourses, ...scheduledCourses];
    
    // 检查所有课程两两之间的冲突
    for (let i = 0; i < courses.length; i++) {
        for (let j = i + 1; j < courses.length; j++) {
            const courseConflicts = findConflicts(courses[i], courses[j]);
            if (courseConflicts.length > 0) {
                conflicts.push({
                    course1: courses[i],
                    course2: courses[j],
                    conflicts: courseConflicts,
                    conflictRate: calculateConflictRate(courseConflicts.length, 
                        Math.min(courses[i].sessions.length, courses[j].sessions.length))
                });
            }
        }
    }
    
    showAllConflicts(conflicts);
    updateConflictCount(conflicts);
}

// 查找两个课程之间的具体冲突
function findConflicts(course1, course2) {
    const conflicts = [];
    
    course1.sessions.forEach(session1 => {
        course2.sessions.forEach(session2 => {
            if (session1.date === session2.date) {
                const start1 = new Date(`${session1.date}T${session1.startTime}`);
                const end1 = new Date(`${session1.date}T${session1.endTime}`);
                const start2 = new Date(`${session2.date}T${session2.startTime}`);
                const end2 = new Date(`${session2.date}T${session2.endTime}`);
                
                if (start1 < end2 && start2 < end1) {
                    conflicts.push({
                        date: session1.date,
                        time: `${session1.startTime.substring(0,5)}-${session1.endTime.substring(0,5)}`
                    });
                }
            }
        });
    });
    
    return conflicts;
}

// 计算冲突率
function calculateConflictRate(conflictsCount, totalSessions) {
    return ((conflictsCount / totalSessions) * 100).toFixed(1);
}

// 显示所有冲突信息
function showAllConflicts(conflicts) {
    const conflictContainer = document.getElementById('conflictInfo');
    if (!conflictContainer) return;
    
    if (conflicts.length === 0) {
        conflictContainer.style.display = 'none';
        return;
    }
    
    let conflictHTML = '<div class="course-conflicts">';
    
    conflicts.forEach(conflict => {
        conflictHTML += `
            <div class="conflict-item">
                <div class="conflict-header">
                    <span class="conflict-courses">${conflict.course1.name} | ${conflict.course2.name}</span>
                    <span class="conflict-rate">${conflict.conflictRate}%</span>
                </div>
                <div class="conflict-details">
                    ${conflict.conflicts.map(c => `
                        <div class="conflict-time-slot">
                            ${formatDate(c.date)} ${c.time}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    conflictHTML += '</div>';
    conflictContainer.innerHTML = conflictHTML;
    conflictContainer.style.display = 'block';
}

// 更新冲突计数
function updateConflictCount(conflicts) {
    const totalConflicts = conflicts.reduce((sum, conflict) => 
        sum + conflict.conflicts.length, 0);
    document.getElementById('conflictCount').textContent = totalConflicts;
}

// 格式化日期显示
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    return `${month}月${day}日 ${weekday}`;
}

// 计算总冲突数
function calculateTotalConflicts() {
    const conflicts = [];
    const courses = [...selectedCourses, ...scheduledCourses];
    
    // 检查所有课程两两之间的冲突
    for (let i = 0; i < courses.length; i++) {
        for (let j = i + 1; j < courses.length; j++) {
            const courseConflicts = findConflicts(courses[i], courses[j]);
            if (courseConflicts.length > 0) {
                conflicts.push({
                    course1: courses[i],
                    course2: courses[j],
                    conflicts: courseConflicts,
                    conflictRate: calculateConflictRate(courseConflicts.length, 
                        Math.min(courses[i].sessions.length, courses[j].sessions.length))
                });
            }
        }
    }
    
    return conflicts.reduce((sum, conflict) => sum + conflict.conflicts.length, 0);
}

// 更新日历事件
function updateCalendarEvents() {
    const events = [];
    
    // 合并已选课程和已排课程
    const mergedSelectedCourses = mergeCoursesByLessonClass(selectedCourses);
    const mergedScheduledCourses = mergeCoursesByLessonClass(scheduledCourses);
    
    // 添加合并后的课程到日历
    [...mergedSelectedCourses, ...mergedScheduledCourses].forEach(course => {
        if (!course.sessions) return;
        
        course.sessions.forEach(session => {
            if (!session.date || !session.startTime || !session.endTime) return;
            
            // 为在线课程添加特殊标记
            const isOnlineCourse = course.isOnline;
            const courseTitle = `${course.name}${isOnlineCourse ? ' (在线)' : ''}${course.hasIclass ? ' 🌐' : ''}`;
            
            events.push({
                title: courseTitle,
                start: `${session.date}T${session.startTime}`,
                end: `${session.date}T${session.endTime}`,
                backgroundColor: isOnlineCourse ? '#4CAF50' : (course.courseType === '已排课' ? '#6c757d' : '#1890ff'),
                borderColor: isOnlineCourse ? '#4CAF50' : (course.courseType === '已排课' ? '#6c757d' : '#1890ff'),
                extendedProps: {
                    lessonClassShortName: course.lessonClassShortName,
                    teacher: course.teacher,
                    classroom: isOnlineCourse ? '线上' : session.classroom,
                    hasIclass: course.hasIclass,
                    isOnline: isOnlineCourse
                }
            });
        });
    });

    calendar.removeAllEvents();
    calendar.addEventSource({events});
}

// 加载课程数据
async function loadCourseData() {
    try {
        const response = await fetch('/course_data.csv');
        const csvText = await response.text();
        const rows = csvText.split('\n').slice(1); // 跳过标题行
        
        // 更新显示
        updateCourseDataDisplay(rows);
    } catch (error) {
        console.error('加载课程数据失败:', error);
        console.error('错误详情:', error.message);
    }
}

// 更新课程数据显示
function updateCourseDataDisplay(rows) {
    const courseDataBody = document.getElementById('courseDataBody');
    courseDataBody.innerHTML = ''; // 清空现有内容

    // 获取已选课程的课程代码（包括基础版本和iclass版本）
    const selectedCourseCodes = selectedCourses.map(course => ({
        code: course.lessonClassShortName,
        baseCode: course.lessonClassShortName.replace('iclass', ''),
        isOnline: course.isOnline
    }));

    rows.forEach(row => {
        if (row.trim() === '') return; // 跳过空行
        
        // 使用正则表达式来正确分割CSV数据
        const matches = row.match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|\s*[^,]*)/g);
        if (!matches) return;
        
        const values = matches.map(match => {
            match = match.startsWith(',') ? match.slice(1) : match;
            if (match.startsWith('"') && match.endsWith('"')) {
                match = match.slice(1, -1).replace(/""/g, '"');
            }
            return match.trim();
        });

        const [
            courseCode,
            courseName,
            courseShortName,
            courseNameEn,
            lessonTaskTeam,
            lessonClassShortName,
            iClassMode,
            language,
            maxNum,
            studentNum,
            totalCredit
        ] = values;

        // 检查是否应该显示此课程
        const matchingCourse = selectedCourseCodes.find(selected => {
            if (showAllCourses) return true;
            // 对于在线课程，匹配带iclass的课程代码
            if (selected.isOnline) {
                return lessonClassShortName.includes('iclass') && 
                       lessonClassShortName.replace('iclass', '') === selected.baseCode;
            }
            // 对于线下课程，匹配不带iclass的课程代码
            return !lessonClassShortName.includes('iclass') && 
                   lessonClassShortName === selected.baseCode;
        });

        if (!showAllCourses && !matchingCourse) {
            return;
        }

        const tr = document.createElement('tr');
        
        // 添加行背景色的逻辑
        const currentNum = parseInt(studentNum) || 0;
        const maxCapacity = parseInt(maxNum) || 0;
        
        // 计算低人数阈值
        let lowThreshold = maxCapacity === 70 ? 35 : (maxCapacity === 35 ? 20 : Math.floor(maxCapacity / 2));
        
        if (currentNum > maxCapacity) {
            tr.style.backgroundColor = '#ffebee'; // 淡红色
        } else if (currentNum < lowThreshold) {
            tr.style.backgroundColor = '#e8f5e9'; // 淡绿色
        }

        // 如果是已选课程，添加高亮效果
        if (matchingCourse) {
            tr.classList.add('table-active');
        }
        
        tr.innerHTML = `
            <td>${courseCode || ''}</td>
            <td>${courseName || ''}</td>
            <td>${courseShortName || ''}</td>
            <td>${courseNameEn || ''}</td>
            <td>${lessonTaskTeam || ''}</td>
            <td>${lessonClassShortName || ''}</td>
            <td style="display: none;">${iClassMode || ''}</td>
            <td>${language || ''}</td>
            <td>${maxNum || '0'}</td>
            <td>${studentNum || '0'}</td>
            <td>${totalCredit || ''}</td>
        `;
        courseDataBody.appendChild(tr);
    });
}

// 切换显示模式
function toggleDisplayMode() {
    showAllCourses = !showAllCourses;
    const toggleBtn = document.getElementById('toggleDisplayBtn');
    toggleBtn.textContent = showAllCourses ? '显示已选' : '显示全部';
    loadCourseData(); // 重新加载数据
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initCalendar();
    loadCourses();
    loadCourseData();

    // 添加切换按钮事件监听
    const toggleBtn = document.getElementById('toggleDisplayBtn');
    toggleBtn.addEventListener('click', toggleDisplayMode);
});
