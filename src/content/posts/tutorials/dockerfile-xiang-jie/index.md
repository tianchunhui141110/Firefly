---
title: "Dockerfile 详解，看这一篇就够了"
published: 2020-06-30
description: "指令格式有两种：注释和指令"
tags: ["Docker"]
category: "Docker"
draft: false
lang: zh_CN
---

指令格式有两种：注释和指令

注释以井号开头，后面跟上信息

指令以大写的指令名开头，后面跟上参数

**常见的指令**

**FROM**

两种形式如下：

```shell
FROM <IMAGE>
FROM <IMAGE>:<TAG>
```

> 通过FROM指定的镜像名称必须是一个已经存在的镜像，这个镜像称之为基础镜像，必须位于第一条非注释指令

**MAINTAINER**

```shell
MAINTAINER <NAME>
```

> 指定镜像的作者信息，包含镜像的所有者和联系人信息

**RUN**

用于指定构建镜像时运行的命令，两种模式：

```shell
RUN <command> (shell模式)
RUN [ "executable", "param1", "param2" ] (exec模式)
```

> 在shell模式下，是使用/bin/sh -c COMMAND来运行命令的在exec模式下可以指定其他的shell来运行命令RUN [“/bin/bash”, “-c”, “echo hello”]

多条RUN指令可以合并为一条：

```shell
RUN yum install httpd && yum install ftp
```

> 这样在构建的时候会减少产生中间层镜像

**EXPOSE**

指定运行该镜像的容器使用的端口，可以是多个。

```shell
EXPOSE <PORT>
```

使用这个指令的目的是告诉应用程序容器内应用程序会使用的端口，在运行时还需要使用-p参数指定映射端口。这是docker处于安全的目的，不会自动打开端口。

```shell
docker run -p 80 -d dockertest/dockerfile_build nginx -g "daemon off"
```

**CMD**

用于提供容器运行的默认命令，如果在docker run时指定了运行的命令，则CMD命令不会执行。

CMD有三种模式：

```shell
CMD <command> (shell模式)
CMD [ "executable", "param1", "param2" ] (exec模式)
CMD [ 'param1', 'param2'] (通常与ENTRYPOINT搭配指定ENTRYPOINT的默认参数)
```

**ENTRYPOINT**

与CMD类似，ENTRYPOINT不会被docker run中指定的命令覆盖，如果想覆盖ENTRYPOINT，则需要在docker run中指定--entrypoint选项

它有两种模式：

```shell
ENTRYPOINT <command> (shell模式)
ENTRYPOINT [ "executable", "param1", "param2" ] (exec模式)
```

**ADD和COPY**

作用都是将文件或目录复制到Dockerfile构建的镜像中

```shell
ADD <src> <dest>
ADD ["<src>" "<dest>"] (适用于文件路径包含空格的情况)
COPY <src> <dest>
ADD ["<src>" "<dest>"] (适用于文件路径包含空格的情况)
```

> ADD包含了类似tar的解压功能，如果只是单纯复制文件，建议使用COPY，而且，两者的源文件路径使用Dockerfile相对路径，目标路径使用绝对路径。

```shell
COPY index.html /var/www/html
```

**VOLUME**

用于向容器添加卷，可以提供共享存储等功能

```shell
VOLUME ['/data']
```

**WORKDIR**

在容器内部设置工作目录，这样ENTRYPOINT和CMD指定的命令都会在容器中这个目录下进行。

```shell
WORKDIR /path/to/workdir
```

**ENV**

用于设置环境变量

```shell
ENV <KEY> <VALUE>
ENV <KEY>=<VALUE>
```

**USER**

用于指定镜像为什么用户去运行

```shell
USER nginx
```

> 镜像就会以nginx身份运行，可以使用uid，gid等各种组合使用

**ONBUILD**

为镜像创建触发器，当一个镜像被用作其他镜像的基础镜像时，这个触发器会被执行。当子镜像被构建时会插入触发器中的指令。

```shell
ONBUILD COPY index.html /var/www/html
```

**Dockerfile的构建过程**

1. docker会从Dockerfile文件头FROM指定的基础镜像运行一个容器
2. 然后执行一条指令，对容器修改
3. 接着执行类似docker commit的操作，创建新的镜像层
4. 在基于刚创建的镜像运行一个新的容器
5. 执行Dockerfile下一条指令，直到所有指令执行完毕

> docker会删除中间层创建的容器，但不会删除中间层镜像，所以可以使用docker run运行一个中间层容器，从而查看每一步构建后的镜像状态，这样就可以进行调试。

**构建缓存**

docker在构建过程中会将之前构建的镜像看做缓存。

当第一次构建的时候，构建过程会比较慢，而在此进行相同的构建的时候，会看见using cache字样，表示使用了缓存，构建过程也非常快。

如果不想使用构建缓存，则在docker build中使用—no-cache选项。

还可以在Dockerfile中使用ENV REFRESH_DATE 2018-01-01来制定缓存刷新时间，更改这个时间，就会让后面的命令不使用缓存。

> 原文链接：https://blog.csdn.net/sinat_35930259/article/details/79679294

