document.addEventListener('DOMContentLoaded', function() {
    // 初始化变量
    let courses = [];
    let selectedCourses = [];
    let calendar;

    // 初始化日历
    initCalendar();

    // 初始化事件监听
    document.getElementById('importBtn').addEventListener('click', showImportModal);
    document.getElementById('exportBtn').addEventListener('click', exportCourses);
    document.getElementById('confirmImport').addEventListener('click', importCourses);

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
            eventClick: handleEventClick
        });
        calendar.render();
    }

    function showImportModal() {
        const modal = new bootstrap.Modal(document.getElementById('importModal'));
        modal.show();
    }

    function importCourses() {
        const fileInput = document.getElementById('csvFile');
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            courses = data.courses;
            renderCourseList();
            bootstrap.Modal.getInstance(document.getElementById('importModal')).hide();
        })
        .catch(error => {
            console.error('Error:', error);
            alert('导入失败，请检查文件格式');
        });
    }

    function renderCourseList() {
        const courseList = document.getElementById('courseList');
        courseList.innerHTML = '';
        
        courses.forEach(course => {
            const div = document.createElement('div');
            div.className = `course-item ${selectedCourses.includes(course) ? 'selected' : ''}`;
            div.innerHTML = `
                <h6>${course.name}</h6>
                <div class="small">
                    <div>教师: ${course.teacher}</div>
                    <div>学分: ${course.credits}</div>
                    <div>时间: ${course.timeSlots}</div>
                    <div>教室: ${course.classroom}</div>
                </div>
            `;
            div.addEventListener('click', () => toggleCourseSelection(course));
            courseList.appendChild(div);
        });
    }

    function toggleCourseSelection(course) {
        const index = selectedCourses.findIndex(c => c.code === course.code);
        if (index === -1) {
            selectedCourses.push(course);
        } else {
            selectedCourses.splice(index, 1);
        }
        updateCalendar();
        checkConflicts();
        renderCourseList();
    }

    function updateCalendar() {
        calendar.removeAllEvents();
        selectedCourses.forEach(course => {
            const events = createEventsFromCourse(course);
            events.forEach(event => calendar.addEvent(event));
        });
    }

    function checkConflicts() {
        fetch('/api/check-conflicts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ courses: selectedCourses })
        })
        .then(response => response.json())
        .then(data => {
            updateConflictDisplay(data.conflicts, data.conflictRate);
        })
        .catch(error => console.error('Error:', error));
    }

    function updateConflictDisplay(conflicts, conflictRate) {
        const conflictInfo = document.getElementById('conflictInfo');
        if (conflicts.length === 0) {
            conflictInfo.innerHTML = '<div class="alert alert-success">没有课程冲突</div>';
            return;
        }

        let html = `
            <div class="conflict-rate">冲突率: ${conflictRate.toFixed(1)}%</div>
        `;

        conflicts.forEach(conflict => {
            html += `
                <div class="conflict-info">
                    <div>${conflict.course1.name} 与 ${conflict.course2.name}</div>
                    <div class="small">冲突时间: ${formatTimeSlots(conflict.conflictSlots)}</div>
                </div>
            `;
        });

        conflictInfo.innerHTML = html;
    }

    function handleEventClick(info) {
        // 处理日历事件点击
        const course = selectedCourses.find(c => c.code === info.event.id);
        if (course) {
            toggleCourseSelection(course);
        }
    }

    function createEventsFromCourse(course) {
        // TODO: 根据课程时间创建日历事件
        // 这里需要根据实际的时间格式进行实现
        return [];
    }

    function formatTimeSlots(slots) {
        // TODO: 格式化时间段显示
        return Array.isArray(slots) ? slots.join(', ') : slots;
    }

    function exportCourses() {
        const csvContent = generateCSV(selectedCourses);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = '已选课程.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function generateCSV(courses) {
        const headers = ['课程代码', '课程名称', '教师', '学分', '时间段', '教室'];
        const rows = courses.map(course => [
            course.code,
            course.name,
            course.teacher,
            course.credits,
            course.timeSlots,
            course.classroom
        ]);
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
});
