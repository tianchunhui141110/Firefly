---
title: "无效的目标发行版 11 的问题解决办法"
published: 2021-12-16
description: "安装了JDK11之后，将原本基于java8的项目换成了java11，然而在maven打包的时候报错：无效的目标发行版 11。"
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

安装了JDK11之后，将原本基于java8的项目换成了java11，然而在maven打包的时候报错：`无效的目标发行版 11`。

百度上查，千篇一律写的都是修改项目设置：将JDK的版本从8改成11,然后修改模块SDK设置,将JDK8改成JDK11

然而以上操作并没有什么卵用,最终在一篇文章中找到了解决方案,特此记录一下:

![image-20211216142646897](https://blog.tianch.com.cn/img/image-20211216142646897.png)

