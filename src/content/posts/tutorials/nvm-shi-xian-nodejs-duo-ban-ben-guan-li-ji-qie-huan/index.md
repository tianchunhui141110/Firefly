---
title: "nvm实现nodejs多版本管理及切换"
published: 2026-01-05
description: ""
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

### nvm实现nodejs多版本管理及切换

## 1.下载nvm

[nvm官网](https://nvm.uihtm.com/)

![image-20231009152217250](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231009152217250.png)

## 2.安装nvm

![nvm安装](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/step1.png)

![nvm安装](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/step2.png)

![nvm安装](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/step3.png)

![nvm安装](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/step4.png)

![image-20231009152648186](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231009152648186.png)

## 3.使用nvm安装nodejs

```cmd
nvm arch：显示node是运行在32位还是64位。
nvm install <version> [arch] ：安装node， version是特定版本也可以是最新稳定版本latest。可选参数arch指定安装32位还是64位版本，默认是系统位数。可以添加--insecure绕过远程服务器的SSL。
nvm list [available] ：显示已安装的列表。可选参数available，显示可安装的所有版本。list可简化为ls。
nvm on ：开启node.js版本管理。
nvm off ：关闭node.js版本管理。
nvm proxy [url] ：设置下载代理。不加可选参数url，显示当前代理。将url设置为none则移除代理。
nvm node_mirror [url] ：设置node镜像。默认是https://nodejs.org/dist/。如果不写url，则使用默认url。设置后可至安装目录settings.txt文件查看，也可直接在该文件操作。
nvm npm_mirror [url] ：设置npm镜像。https://github.com/npm/cli/archive/。如果不写url，则使用默认url。设置后可至安装目录settings.txt文件查看，也可直接在该文件操作。
nvm uninstall <version> ：卸载指定版本node。
nvm use [version] [arch] ：使用制定版本node。可指定32/64位。
nvm root [path] ：设置存储不同版本node的目录。如果未设置，默认使用当前目录。
nvm version ：显示nvm版本。version可简化为v。
```

```cmd
nvm list available
```

![image-20231009152924109](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231009152924109.png)

- 安装nodejs最新版本

  ```cmd
  nvm install latest
  ```

- 安装nodejs指定版本

  ```cmd
  nvm install 18.18.0
  ```

- 查看已安装nodejs版本

  ```cmd
  nvm list
  nvm ls
  ```

  ![image-20231009153240638](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231009153240638.png)

- 切换nodejs版本

  ```cmd
  nvm use 16.19.0
  ```

