// 全局变量
let calendar;
let preloadedCourses = [];
let selectedCourses = [];
let scheduledCourses = [];

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
        
        // 跳过包含iclass的课程
        if (course.lessonClassShortName.toLowerCase().includes('iclass')) return;
        
        const key = course.lessonClassShortName;
        
        if (!mergedMap.has(key)) {
            // 创建新的合并课程对象
            mergedMap.set(key, {
                ...course,
                sessions: [...(course.sessions || [])],
                hasIclass: course.iclassMode ? true : false
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
        const isSelected = selectedCourses.some(selected => 
            selected.lessonClassShortName === course.lessonClassShortName
        );
        
        const courseElement = document.createElement('div');
        courseElement.className = `course-item ${isSelected ? 'selected' : ''}`;
        
        // 压缩显示的时间信息
        const timeInfo = course.sessions ? course.sessions.map(session => 
            `${session.date.split('-')[2]}日 ${session.startTime.substring(0, 5)}`
        ).join(', ') : '';
        
        // 完整的时间信息（用于悬停显示）
        const fullTimeInfo = course.sessions ? course.sessions.map(session =>
            `${session.date} ${session.startTime.substring(0, 5)}-${session.endTime.substring(0, 5)} ${session.classroom}`
        ).join('\n') : '';

        courseElement.innerHTML = `
            <div class="course-header">
                <span class="course-name">${course.name}${course.hasIclass ? ' 🌐' : ''}</span>
            </div>
            <div class="course-info">
                <span class="course-teacher">${course.teacher || ''}</span>
                <span class="course-time" title="${fullTimeInfo}">${timeInfo}</span>
            </div>
        `;

        courseElement.addEventListener('click', () => toggleCourseSelection(course));
        courseListElement.appendChild(courseElement);
    });
}

// 切换课程选择状态
function toggleCourseSelection(course) {
    console.log('Toggling course selection:', course);
    const index = selectedCourses.findIndex(selected => 
        selected.lessonClassShortName === course.lessonClassShortName
    );
    
    if (index === -1) {
        selectedCourses.push(course);
        console.log('Course added to selection');
    } else {
        selectedCourses.splice(index, 1);
        console.log('Course removed from selection');
    }
    
    updateCalendarEvents();
    updateCourseList();
    updateStatistics();
    checkAllConflicts(); // 更新冲突信息
}

// 更新统计信息
function updateStatistics() {
    const selectedCount = selectedCourses.length;
    const totalCredits = selectedCourses.reduce((sum, course) => sum + (course.credits || 0), 0);
    const totalHours = selectedCourses.reduce((sum, course) => sum + (course.totalHour || 0), 0);
    
    document.getElementById('selectedCourseCount').textContent = selectedCount;
    document.getElementById('totalCredits').textContent = totalCredits;
    document.getElementById('totalHours').textContent = totalHours;
    document.getElementById('conflictCount').textContent = '0'; // 暂时设为0
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
            
            events.push({
                title: `${course.name}${course.hasIclass ? ' 🌐' : ''}`,
                start: `${session.date}T${session.startTime}`,
                end: `${session.date}T${session.endTime}`,
                backgroundColor: course.courseType === '已排课' ? '#6c757d' : '#1890ff',
                borderColor: course.courseType === '已排课' ? '#6c757d' : '#1890ff',
                extendedProps: {
                    lessonClassShortName: course.lessonClassShortName,
                    teacher: course.teacher,
                    classroom: session.classroom,
                    hasIclass: course.hasIclass
                }
            });
        });
    });

    calendar.removeAllEvents();
    calendar.addEventSource({events});
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initCalendar();
    loadCourses();
});
