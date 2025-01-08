import subprocess
import sys
import os
import webbrowser
from time import sleep

def main():
    print("正在启动课程选择系统...")
    
    # 检查是否有虚拟环境
    venv_python = os.path.join('venv', 'Scripts', 'python.exe') if os.name == 'nt' else os.path.join('venv', 'bin', 'python')
    python_cmd = venv_python if os.path.exists(venv_python) else 'python'
    
    try:
        # 创建虚拟环境（如果不存在）
        if not os.path.exists('venv'):
            print("创建虚拟环境...")
            subprocess.run([sys.executable, '-m', 'venv', 'venv'], check=True)
            
        # 安装依赖
        print("安装依赖...")
        pip_cmd = os.path.join('venv', 'Scripts', 'pip.exe') if os.name == 'nt' else os.path.join('venv', 'bin', 'pip')
        subprocess.run([pip_cmd, 'install', '-r', 'requirements.txt'], check=True)
        
        # 运行应用
        print("启动应用...")
        flask_process = subprocess.Popen([python_cmd, 'run.py'])
        
        # 等待几秒钟确保服务器启动
        sleep(2)
        
        # 打开浏览器
        print("正在打开浏览器...")
        webbrowser.open('http://localhost:5000')
        
        # 等待用户按下Ctrl+C
        print("\n应用已启动！按Ctrl+C退出...")
        flask_process.wait()
        
    except KeyboardInterrupt:
        print("\n正在关闭应用...")
        if 'flask_process' in locals():
            flask_process.terminate()
    except Exception as e:
        print(f"发生错误: {e}")
        input("按Enter键退出...")
        sys.exit(1)

if __name__ == '__main__':
    main()
