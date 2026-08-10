---
title: "Windows远程桌面提示出现身份验证错误"
published: 2020-06-13
description: "使用命令“gpedit.msc”打开组策略。"
tags: ["CentOS"]
category: "Linux"
draft: false
lang: zh_CN
---

##### 配置本地组策略：

**使用命令“gpedit.msc”打开组策略。**

**计算机配置>管理模板>系统>凭据分配>加密数据库修正**

**选择启用并选择易受攻击。**

![image](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image_thumb-28.png)

