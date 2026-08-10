---
title: "CentOS7图形化界面安装及卸载"
published: 2020-06-13
description: ""
tags: ["CentOS"]
category: "Linux"
draft: false
lang: zh_CN
---

- ##### 安装图形化界面

  ```shell
  yum groupinstall "GNOME Desktop" "Graphical Administration Tools"
  ```

- ##### 设置系统启动等级
  - 获取当前系统运行形式

    ```shell
    systemctl get-default

    # multi-user.target（命令行终端）
    # graphical.target (t图像化桌面)
    ```

  - 设置默认启动为图形界面 reboot生效

    ```shell
    systemctl set-default graphical.target
    ```

  - 设置默认启动为命令行界面reboot生效

    ```shell
    systemctl set-default multi-user.target
    ```

- ##### 卸载图形化界面

  ```shell
  yum groupremove "GNOME Desktop" "Graphical Administration Tools"
  ```

