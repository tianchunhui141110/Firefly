---
title: "IDEA运行报Command line is too long解决办法"
published: 2020-05-09
description: "Error running 'XXXX': Command line is too long. Shorten command line for ServiceStarter or also for Application default "
tags: ["IDEA"]
category: "Java"
draft: false
lang: zh_CN
---

报错内容:

Error running 'XXXX': Command line is too long. Shorten command line for ServiceStarter or also for Application default configuration.

解决方案:

修改项目下 .idea\workspace.xml

找到标签

```xml

```

在标签里加一行:

```xml

```

产生原因:

根据大佬们查到的解释如下: 该选项控制如何将classpath传递给JVM：通过命令行或通过文件。大多数操作系统都有最大的命令行限制，当它超过时，IDEA将无法运行您的应用程序。 当命令行长于32768个字符时，IDEA建议您切换到动态类路径。长类路径被写入文件，然后由应用程序启动器读取并通过系统类加载器加载。 如果您对实施细节感兴趣，可以查看IDEA社区版的源代码，JdkUtil.java文件，setupJVMCommandLine方法。
