# 部署指南

本文档介绍如何将课程选择系统部署到云服务器。

## 系统要求

- Python 3.7+
- Nginx
- Git

## 部署步骤

### 1. 准备服务器

```bash
# 更新系统包
sudo apt update
sudo apt upgrade

# 安装必要的系统包
sudo apt install python3-pip python3-venv nginx git
```

### 2. 克隆项目

```bash
git clone [your-repository-url]
cd Course-scheduler
```

### 3. 设置Python环境

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 4. 配置环境变量

创建 `.env` 文件并设置必要的环境变量：

```bash
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///app.db
LOG_TO_STDOUT=1
```

### 5. 配置Nginx

创建Nginx配置文件：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

保存到 `/etc/nginx/sites-available/course-scheduler` 并启用：

```bash
sudo ln -s /etc/nginx/sites-available/course-scheduler /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
```

### 6. 设置Systemd服务

创建服务文件 `/etc/systemd/system/course-scheduler.service`：

```ini
[Unit]
Description=Course Scheduler Gunicorn daemon
After=network.target

[Service]
User=your-username
WorkingDirectory=/path/to/Course-scheduler
Environment="PATH=/path/to/Course-scheduler/venv/bin"
ExecStart=/path/to/Course-scheduler/venv/bin/gunicorn -c gunicorn_config.py "app:create_app()"

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl start course-scheduler
sudo systemctl enable course-scheduler
```

### 7. 设置防火墙

```bash
sudo ufw allow 80
sudo ufw allow 443  # 如果使用HTTPS
```

## 更新部署

当需要更新应用时：

```bash
cd /path/to/Course-scheduler
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart course-scheduler
```

## 监控

查看应用日志：
```bash
sudo journalctl -u course-scheduler
```

## 故障排除

1. 检查Gunicorn日志：
```bash
tail -f logs/course_scheduler.log
```

2. 检查Nginx日志：
```bash
sudo tail -f /var/log/nginx/error.log
```

3. 检查服务状态：
```bash
sudo systemctl status course-scheduler
```
