---
title: "IDEA控制台Tomcat乱码的问题解决"
published: 2026-01-05
description: "在Tomcat配置项VM options文本框中输入-Dfile.encoding=UTF-8"
tags: ["运维"]
category: "Java"
draft: false
lang: zh_CN
---

1. 配置`idea64.exe.vmoptions`文件

   ```vmoptions
   -Dfile.encoding=UTF-8
   ```

   ![image-20220126173835082](https://oss.tianch.xyz/img/image-20220126173835082.png)

2. IDEA全局编码设置成UTF-8

   ![image-20220126174205707](https://oss.tianch.xyz/img/image-20220126174205707.png)

3. IDEA项目配置

   `在Tomcat配置项VM options文本框中输入-Dfile.encoding=UTF-8`

   ![image-20220126174427034](https://oss.tianch.xyz/img/image-20220126174427034.png)

4. 配置Tomcat的配置文件`logging.properties`

   百度上面很多只有前3种,我都试了还是乱码,最后发现这里配置的是`GBK`,改成`UTF-8`控制台就不再乱码了.

   ```properties
   java.util.logging.ConsoleHandler.encoding = UTF-8
   ```

   ![image-20220126174648760](https://oss.tianch.xyz/img/image-20220126174648760.png)

