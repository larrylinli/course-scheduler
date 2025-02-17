# 课程选择系统

一个简单的课程选择系统，帮助学生更好地规划和选择课程。

## 功能特点

- 课程信息的CSV导入导出
- 多月份日历视图展示课程安排
- 实时冲突检测和显示
- 课程时间冲突率计算
- 便捷的课程选择界面

## 运行方法

1. 确保已安装Python 3.7或更高版本
2. 双击运行 `start.py`
3. 等待系统自动打开浏览器
4. 开始使用系统

## 使用说明

1. 点击"导入课程"按钮，选择课程信息CSV文件
2. 在左侧列表中选择想要添加的课程
3. 在日历视图中查看课程安排
4. 如果有时间冲突，系统会在左下角显示冲突信息
5. 使用"导出选课"按钮保存选课结果

## CSV文件格式

课程信息CSV文件应包含以下字段：
- 课程代码
- 课程名称
- 教师
- 学分
- 时间段
- 教室
