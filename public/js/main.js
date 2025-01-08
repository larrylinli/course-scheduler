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
        // 检查时间冲突但仍然允许选课
        const conflicts = checkTimeConflict(course);
        selectedCourses.push(course);
        console.log('Course added to selection');
    } else {
        selectedCourses.splice(index, 1);
        console.log('Course removed from selection');
        // 清除冲突信息
        const conflictContainer = document.getElementById('conflictInfo');
        if (conflictContainer) {
            conflictContainer.style.display = 'none';
        }
    }
    
    updateCalendarEvents();
    updateCourseList();
    updateStatistics();
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

// 检查时间冲突
function checkTimeConflict(newCourse) {
    // 合并现有课程
    const mergedExistingCourses = mergeCoursesByLessonClass([...selectedCourses, ...scheduledCourses]);
    
    // 获取新课程的唯一会话（按日期）
    const newSessions = new Map();
    newCourse.sessions.forEach(session => {
        if (!newSessions.has(session.date)) {
            newSessions.set(session.date, session);
        }
    });

    const conflicts = [];
    newSessions.forEach((newSession, date) => {
        const newStart = new Date(`${date}T${newSession.startTime}`);
        const newEnd = new Date(`${date}T${newSession.endTime}`);

        mergedExistingCourses.forEach(existingCourse => {
            if (existingCourse.lessonClassShortName === newCourse.lessonClassShortName) return;

            existingCourse.sessions.forEach(existingSession => {
                if (existingSession.date !== date) return;

                const existingStart = new Date(`${existingSession.date}T${existingSession.startTime}`);
                const existingEnd = new Date(`${existingSession.date}T${existingSession.endTime}`);

                if (newStart < existingEnd && existingStart < newEnd) {
                    conflicts.push({
                        date: existingSession.date,
                        time: `${existingSession.startTime.substring(0,5)}-${existingSession.endTime.substring(0,5)}`,
                        courseName: existingCourse.name,
                        lessonClassShortName: existingCourse.lessonClassShortName,
                        teacher: existingCourse.teacher,
                        classroom: existingSession.classroom,
                        type: existingCourse.courseType || '选修课'
                    });
                }
            });
        });
    });

    if (conflicts.length > 0) {
        showConflictInfo(newCourse, conflicts, newSessions.size);
    }

    return conflicts;
}

// 显示冲突信息
function showConflictInfo(newCourse, conflicts, totalUniqueDates) {
    // 计算冲突率：冲突的不重复日期数量 / 总的不重复日期数量
    const uniqueConflictDates = new Set(conflicts.map(c => c.date));
    const conflictRate = (uniqueConflictDates.size / totalUniqueDates * 100).toFixed(1);
    
    // 按日期分组冲突信息
    const conflictsByDate = conflicts.reduce((acc, conflict) => {
        if (!acc[conflict.date]) {
            acc[conflict.date] = [];
        }
        acc[conflict.date].push(conflict);
        return acc;
    }, {});

    // 创建冲突信息的HTML
    const conflictHTML = `
        <div class="course-conflict">
            <div class="conflict-header">
                <span class="conflict-title">课程冲突</span>
                <span class="conflict-rate">${conflictRate}%</span>
            </div>
            <div class="conflict-detail">
                <div class="conflict-course-name">${newCourse.name}</div>
                ${Object.entries(conflictsByDate).map(([date, dateConflicts]) => `
                    <div class="conflict-date-group">
                        <div class="conflict-date">${formatDate(date)}</div>
                        ${dateConflicts.map(conflict => `
                            <div class="conflict-time-item">
                                <span class="conflict-time">${conflict.time}</span>
                                <span class="conflict-with">与</span>
                                <span class="conflict-course">${conflict.courseName}</span>
                                <span class="conflict-type">(${conflict.type})</span>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // 显示冲突信息
    const conflictContainer = document.getElementById('conflictInfo');
    if (conflictContainer) {
        conflictContainer.innerHTML = conflictHTML;
        conflictContainer.style.display = 'block';
    } else {
        console.error('Conflict container not found');
    }
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
