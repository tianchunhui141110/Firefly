---
title: "Xshell连接虚拟机特别慢的解决方案"
published: 2021-01-05
description: "习惯了云服务器Xshell几乎秒连，最近遇到Xshell连接虚拟机贼慢，可以说是龟速......，于是乎，百度查了一下，还真有同样问题的，遂按照网上说的动手操作，还别说，居然解决了："
tags: ["运维"]
category: "Linux"
draft: false
lang: zh_CN
---

习惯了云服务器Xshell几乎秒连，最近遇到Xshell连接虚拟机贼慢，可以说是龟速......，于是乎，百度查了一下，还真有同样问题的，遂按照网上说的动手操作，还别说，居然解决了：

- 修改配置 /etc/ssh/sshd_config

  ```shell
  yum install -y vim
  vim /etc/ssh/sshd_config

  #配置文件中有这样一行配置
  #UseDNS yes

  # 解开注释 将yes改为no

  UseDNS no
  ```

- 重启ssh服务

  ```shell
  systemctl restart sshd
  ```

[参考连接](https://www.cnblogs.com/areyouready/p/10134771.html)

