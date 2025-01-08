document.addEventListener('DOMContentLoaded', function() {
    let calendar;
    let preloadedCourses = [];
    let scheduledCourses = [];
    let selectedCourses = [];

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

    // 更新日历事件
    function updateCalendarEvents() {
        // 清除所有现有事件
        calendar.removeAllEvents();

        console.log('Updating calendar events...');
        console.log('Scheduled courses:', scheduledCourses.length);
        console.log('Selected courses:', selectedCourses.length);

        // 添加已排课程事件（灰色）
        scheduledCourses.forEach(course => {
            console.log(`Processing scheduled course: ${course.name}`, course);
            course.sessions.forEach(session => {
                const eventStart = `${session.date}T${session.startTime}`;
                const eventEnd = `${session.date}T${session.endTime}`;
                
                console.log(`Creating event for ${course.name}:`, {
                    date: session.date,
                    start: eventStart,
                    end: eventEnd
                });

                const event = {
                    title: `${course.name}\n${course.teacher}\n${session.classroom}`,
                    start: eventStart,
                    end: eventEnd,
                    backgroundColor: '#6c757d',
                    borderColor: '#6c757d',
                    textColor: '#ffffff',
                    extendedProps: { 
                        courseType: 'scheduled', 
                        courseData: course,
                        sessionData: session
                    }
                };

                try {
                    calendar.addEvent(event);
                    console.log('Event added successfully');
                } catch (error) {
                    console.error('Error adding event:', error);
                }
            });
        });

        // 添加已选课程事件（蓝色）
        selectedCourses.forEach(course => {
            console.log(`Processing selected course: ${course.name}`, course);
            course.sessions.forEach(session => {
                const eventStart = `${session.date}T${session.startTime}`;
                const eventEnd = `${session.date}T${session.endTime}`;
                
                console.log(`Creating event for ${course.name}:`, {
                    date: session.date,
                    start: eventStart,
                    end: eventEnd
                });

                const event = {
                    title: `${course.name}\n${course.teacher}\n${session.classroom}`,
                    start: eventStart,
                    end: eventEnd,
                    backgroundColor: '#0d6efd',
                    borderColor: '#0d6efd',
                    textColor: '#ffffff',
                    extendedProps: { 
                        courseType: 'selected', 
                        courseData: course,
                        sessionData: session
                    }
                };

                try {
                    calendar.addEvent(event);
                    console.log('Event added successfully');
                } catch (error) {
                    console.error('Error adding event:', error);
                }
            });
        });

        try {
            calendar.render();
            console.log('Calendar rendered successfully');
        } catch (error) {
            console.error('Error rendering calendar:', error);
        }
    }

    // 更新课程列表显示
    function updateCourseList() {
        const courseList = document.getElementById('courseList');
        courseList.innerHTML = '';

        preloadedCourses.forEach(course => {
            const isSelected = selectedCourses.some(selected => selected.code === course.code);
            const div = document.createElement('div');
            div.className = `course-item${isSelected ? ' selected' : ''}`;
            div.innerHTML = `
                <h5>${course.name}</h5>
                <p>教师：${course.teacher}</p>
                <p>学分：${course.credits}</p>
                <p>课时：${course.totalHour}</p>
                <p>语言：${course.language}</p>
                <p>上课时间：</p>
                <ul>
                    ${course.sessions.map(session => `
                        <li>${session.date} ${session.startTime}-${session.endTime}
                        <br>教室：${session.classroom}</li>
                    `).join('')}
                </ul>
            `;

            div.addEventListener('click', () => toggleCourseSelection(course));
            courseList.appendChild(div);
        });
    }

    // 切换课程选择状态
    function toggleCourseSelection(course) {
        console.log('Toggling course selection:', course);
        const index = selectedCourses.findIndex(selected => selected.code === course.code);
        if (index === -1) {
            // 检查时间冲突
            const hasConflict = checkTimeConflict(course);
            if (hasConflict) {
                alert('该课程与已选课程或已排课程时间冲突！');
                return;
            }
            selectedCourses.push(course);
            console.log('Course added to selection');
        } else {
            selectedCourses.splice(index, 1);
            console.log('Course removed from selection');
        }
        updateCalendarEvents();
        updateCourseList();
        updateStatistics();
    }

    // 检查时间冲突
    function checkTimeConflict(newCourse) {
        const allSelectedSessions = selectedCourses.flatMap(course => course.sessions);
        const scheduledSessions = scheduledCourses.flatMap(course => course.sessions);
        const allSessions = [...allSelectedSessions, ...scheduledSessions];

        return newCourse.sessions.some(newSession => {
            const newStart = new Date(`${newSession.date}T${newSession.startTime}`);
            const newEnd = new Date(`${newSession.date}T${newSession.endTime}`);

            return allSessions.some(existingSession => {
                const existingStart = new Date(`${existingSession.date}T${existingSession.startTime}`);
                const existingEnd = new Date(`${existingSession.date}T${existingSession.endTime}`);

                return (newStart < existingEnd && existingStart < newEnd);
            });
        });
    }

    // 更新统计信息
    function updateStatistics() {
        const selectedCredits = selectedCourses.reduce((sum, course) => sum + course.credits, 0);
        const scheduledCredits = scheduledCourses.reduce((sum, course) => sum + course.credits, 0);
        const selectedHours = selectedCourses.reduce((sum, course) => sum + course.totalHour, 0);
        const scheduledHours = scheduledCourses.reduce((sum, course) => sum + course.totalHour, 0);
        
        // 获取唯一的课程地点
        const locations = new Set([
            ...selectedCourses.flatMap(course => course.sessions.map(session => session.classroom)),
            ...scheduledCourses.flatMap(course => course.sessions.map(session => session.classroom))
        ]);

        // 更新统计信息
        document.getElementById('selectedCourseCount').textContent = selectedCourses.length + scheduledCourses.length;
        document.getElementById('totalCredits').textContent = selectedCredits + scheduledCredits;
        document.getElementById('totalHours').textContent = selectedHours + scheduledHours;
        document.getElementById('locationCount').textContent = locations.size;
    }

    // 加载课程数据
    async function loadCourses() {
        try {
            const response = await fetch('/api/courses');
            const data = await response.json();
            
            preloadedCourses = data.electiveCourses;
            scheduledCourses = data.scheduledCourses;
            
            console.log('Loaded courses:', {
                elective: preloadedCourses.length,
                scheduled: scheduledCourses.length
            });

            // 打印一些示例数据
            if (scheduledCourses.length > 0) {
                console.log('Sample scheduled course:', scheduledCourses[0]);
                console.log('Sample session:', scheduledCourses[0].sessions[0]);
            }

            updateCourseList();
            updateCalendarEvents();
            updateStatistics();
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    // 初始化
    initCalendar();
    loadCourses();
});
