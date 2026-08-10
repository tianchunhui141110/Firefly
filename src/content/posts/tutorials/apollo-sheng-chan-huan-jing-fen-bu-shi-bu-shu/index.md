---
title: "Apollo生产环境分布式部署"
published: 2026-01-05
description: "服务端基于Spring Boot，启动脚本理论上支持所有Linux发行版，建议CentOS 7。"
tags: ["Apollo","分布式"]
category: "中间件"
draft: false
lang: zh_CN
---

## 一、准备工作

## 1.1 运行时环境

## 1.1.1 OS

服务端基于Spring Boot，启动脚本理论上支持所有Linux发行版，建议[CentOS 7](https://www.centos.org/)。

## 1.1.2 Java

- Apollo服务端：1.8+
- Apollo客户端：1.7+

由于需要同时运行服务端和客户端，所以建议安装Java 1.8+。

> 对于Apollo客户端，运行时环境只需要1.7+即可。

在配置好后，可以通过如下命令检查：

```shell
java -version
```

## 1.2 MySQL

- 版本要求：5.6.5+

Apollo的表结构对`timestamp`使用了多个default声明，所以需要5.6.5以上版本。

连接上MySQL后，可以通过如下命令检查：

```shell
SHOW VARIABLES WHERE Variable_name = 'version';
```

## 1.3 Docker部署

Apollo项目已经自带了Docker file，可以参照[2.2 获取安装包](https://github.com/ctripcorp/apollo/wiki/分布式部署指南#22-获取安装包)配置好安装包后通过下面的文件来打Docker镜像：

1. [apollo-configservice](https://github.com/ctripcorp/apollo/blob/master/apollo-configservice/src/main/docker/Dockerfile)
2. [apollo-adminservice](https://github.com/ctripcorp/apollo/blob/master/apollo-adminservice/src/main/docker/Dockerfile)
3. [apollo-portal](https://github.com/ctripcorp/apollo/blob/master/apollo-portal/src/main/docker/Dockerfile)

## 二、部署步骤

部署步骤共三步：

1. 创建数据库
   - Apollo服务端依赖于MySQL数据库，所以需要事先创建并完成初始化
2. 获取安装包
   - Apollo服务端安装包共有3个：apollo-configservice, apollo-adminservice, apollo-portal
     - 可以直接下载我们事先打好的安装包，也可以自己通过源码构建
3. 部署Apollo服务端
   - 获取安装包后就可以部署到测试和生产环境了

## 2.1 创建数据库

Apollo服务端共需要两个数据库：`ApolloPortalDB`和`ApolloConfigDB`，我们把数据库、表的创建和样例数据都分别准备了sql文件，只需要导入数据库即可。

需要注意的是ApolloPortalDB只需要在生产环境部署一个即可，而ApolloConfigDB需要在每个环境部署一套，如dev、test和pro分别部署3套ApolloConfigDB。

### 2.1.1 创建ApolloPortalDB

#### 2.1.1.1 手动导入SQL创建

通过各种MySQL客户端导入[apolloportaldb.sql](https://github.com/ctripcorp/apollo/blob/master/scripts/sql/apolloportaldb.sql)即可。

以MySQL原生客户端为例：

```shell
source /your_local_path/scripts/sql/apolloportaldb.sql
```

#### 2.1.1.3 验证

导入成功后，可以通过执行以下sql语句来验证：

```mysql
select `Id`, `Key`, `Value`, `Comment` from `ApolloPortalDB`.`ServerConfig` limit 1;
```

| Id  | Key                | Value | Comment          |
| --- | ------------------ | ----- | :--------------- |
| 1   | apollo.portal.envs | dev   | 可支持的环境列表 |

### 2.1.2 创建ApolloConfigDB

#### 2.1.2.1 手动导入SQL

通过各种MySQL客户端导入[apolloconfigdb.sql](https://github.com/ctripcorp/apollo/blob/master/scripts/sql/apolloconfigdb.sql)即可。

以MySQL原生客户端为例：

```shell
source /your_local_path/scripts/sql/apolloconfigdb.sql
```

#### 2.1.2.3 验证

导入成功后，可以通过执行以下sql语句来验证：

```mysql
select `Id`, `Key`, `Value`, `Comment` from `ApolloConfigDB`.`ServerConfig` limit 1;
```

| Id  | Key                | Value                         | Comment       |
| --- | ------------------ | ----------------------------- | ------------- |
| 1   | eureka.service.url | http://127.0.0.1:8080/eureka/ | Eureka服务Url |

```shell


docker run -p 8080:8080 -e DS_URL="jdbc:mysql://192.168.123.5:3306/ApolloConfigDB?characterEncoding=utf8" -e DS_USERNAME=root -e DS_PASSWORD=root -d -v /tmp/logs:/opt/logs --name apollo-configservice apollo-configservice
```

### 2.1.3 调整服务端配置

Apollo自身的一些配置是放在数据库里面的，所以需要针对实际情况做一些调整。

> 以下配置除了支持在数据库中配置以外，也支持通过-D参数、application.properties等配置，且-D参数、application.properties等优先级高于数据库中的配置

#### 2.1.3.1 调整ApolloPortalDB配置

配置项统一存储在ApolloPortalDB.ServerConfig表中，也可以通过`管理员工具 - 系统参数`页面进行配置，无特殊说明则修改完一分钟实时生效。

##### 1.apollo.portal.envs - 可支持的环境列表

默认值是dev，如果portal需要管理多个环境的话，以逗号分隔即可（大小写不敏感），如：

```
DEV,FAT,UAT,PRO
```

修改完需要重启生效。

> 注1：一套Portal可以管理多个环境，但是每个环境都需要独立部署一套Config Service、Admin Service和ApolloConfigDB，具体请参考：[2.1.2 创建ApolloConfigDB](https://github.com/ctripcorp/apollo/wiki/分布式部署指南#212-创建apolloconfigdb)，[2.1.3.2 调整ApolloConfigDB配置](https://github.com/ctripcorp/apollo/wiki/分布式部署指南#2132-调整apolloconfigdb配置)，[2.2.1.2 配置数据库连接信息](https://github.com/ctripcorp/apollo/wiki/分布式部署指南#2212-配置数据库连接信息)，另外如果是为已经运行了一段时间的Apollo配置中心增加环境，别忘了参考[2.1.2.1 从别的环境导入ApolloConfigDB的项目数据](https://github.com/ctripcorp/apollo/wiki/分布式部署指南#2121-从别的环境导入apolloconfigdb的项目数据)对新的环境做初始化。

> 注2：只在数据库添加环境是不起作用的，还需要为apollo-portal添加新增环境对应的meta server地址，具体参考：[2.2.1.2.4 配置apollo-portal的meta service信息](https://github.com/ctripcorp/apollo/wiki/分布式部署指南#22124-配置apollo-portal的meta-service信息)。apollo-client在新的环境下使用时也需要做好相应的配置，具体参考：[1.2.2 Apollo Meta Server](https://github.com/ctripcorp/apollo/wiki/Java客户端使用指南#122-apollo-meta-server)。

> 注3：如果希望添加自定义的环境名称，具体步骤可以参考[Portal如何增加环境](https://github.com/ctripcorp/apollo/wiki/部署&开发遇到的常见问题#4-portal如何增加环境)。

> 注4：1.1.0版本增加了系统信息页面（`管理员工具` -> `系统信息`），可以通过该页面检查配置是否正确

##### 3.superAdmin - Portal超级管理员

超级管理员拥有所有权限，需要谨慎设置。

如果没有接入自己公司的SSO系统的话，可以先暂时使用默认值apollo（默认用户）。等接入后，修改为实际使用的账号，多个账号以英文逗号分隔(,)。

##### 4.consumer.token.salt - consumer token salt

如果会使用开放平台API的话，可以设置一个token salt。如果不使用，可以忽略。

##### 5.wiki.address

portal上“帮助”链接的地址，默认是Apollo github的wiki首页，可自行设置。

##### 6.admin.createPrivateNamespace.switch

是否允许项目管理员创建private namespace。设置为`true`允许创建，设置为`false`则项目管理员在页面上看不到创建private namespace的选项。[了解更多Namespace](https://github.com/ctripcorp/apollo/wiki/Apollo核心概念之"Namespace")

##### 7. emergencyPublish.supported.envs

配置允许紧急发布的环境列表，多个env以英文逗号分隔。

当config service开启一次发布只能有一个人修改开关(`namespace.lock.switch`)后，一次配置发布只能是一个人修改，另一个发布。为了避免遇到紧急情况时（如非工作时间、节假日）无法发布配置，可以配置此项以允许某些环境可以操作紧急发布，即同一个人可以修改并发布配置。

##### 8. configView.memberOnly.envs

只对项目成员显示配置信息的环境列表，多个env以英文逗号分隔。

对设定了只对项目成员显示配置信息的环境，只有该项目的管理员或拥有该namespace的编辑或发布权限的用户才能看到该私有namespace的配置信息和发布历史。公共namespace始终对所有用户可见。

> 从1.1.0版本开始支持，详见[PR 1531](https://github.com/ctripcorp/apollo/pull/1531)

##### 9. role.create-application.enabled - 是否开启创建项目权限控制

> 适用于1.5.0及以上版本

默认为false，所有用户都可以创建项目

如果设置为true，那么只有超级管理员和拥有创建项目权限的帐号可以创建项目，超级管理员可以通过`管理员工具 - 系统权限管理`给用户分配创建项目权限

##### 10. role.manage-app-master.enabled - 是否开启项目管理员分配权限控制

> 适用于1.5.0及以上版本

默认为false，所有项目的管理员可以为项目添加/删除管理员

如果设置为true，那么只有超级管理员和拥有项目管理员分配权限的帐号可以为特定项目添加/删除管理员，超级管理员可以通过`管理员工具 - 系统权限管理`给用户分配特定项目的管理员分配权限

##### 11. prefix.path - 设置Portal挂载到nginx/slb后的相对路径

> 适用于1.6.0及以上版本

如果希望在Portal前挂软负载，一般情况下建议直接使用根目录来挂载，不过如果有些情况希望和其它应用共用nginx/slb，需要加上相对路径，那么可以配置此项，如`prefix.path=/apollo`，更多信息可以参考[Portal挂载到nginx/slb后如何设置相对路径？](https://github.com/ctripcorp/apollo/wiki/部署&开发遇到的常见问题#16-portal挂载到nginxslb后如何设置相对路径)。

修改完需要重启生效。

#### 2.1.3.2 调整ApolloConfigDB配置

配置项统一存储在ApolloConfigDB.ServerConfig表中，需要注意每个环境的ApolloConfigDB.ServerConfig都需要单独配置，修改完一分钟实时生效。

##### 1. eureka.service.url - Eureka服务Url

不管是apollo-configservice还是apollo-adminservice都需要向eureka服务注册，所以需要配置eureka服务地址。 按照目前的实现，apollo-configservice本身就是一个eureka服务，所以只需要填入apollo-configservice的地址即可，如有多个，用逗号分隔（注意不要忘了/eureka/后缀）。

需要注意的是每个环境只填入自己环境的eureka服务地址，比如FAT的apollo-configservice是1.1.1.1:8080和2.2.2.2:8080，UAT的apollo-configservice是3.3.3.3:8080和4.4.4.4:8080，PRO的apollo-configservice是5.5.5.5:8080和6.6.6.6:8080，那么：

1. 在FAT环境的ApolloConfigDB.ServerConfig表中设置eureka.service.url为：

```
http://1.1.1.1:8080/eureka/,http://2.2.2.2:8080/eureka/
```

1. 在UAT环境的ApolloConfigDB.ServerConfig表中设置eureka.service.url为：

```
http://3.3.3.3:8080/eureka/,http://4.4.4.4:8080/eureka/
```

1. 在PRO环境的ApolloConfigDB.ServerConfig表中设置eureka.service.url为：

```
http://5.5.5.5:8080/eureka/,http://6.6.6.6:8080/eureka/
```

> 注1：这里需要填写本环境中全部的eureka服务地址，因为eureka需要互相复制注册信息

> 注2：如果希望将Config Service和Admin Service注册到公司统一的Eureka上，可以参考[部署&开发遇到的常见问题 - 将Config Service和Admin Service注册到单独的Eureka Server上](https://github.com/ctripcorp/apollo/wiki/部署&开发遇到的常见问题#8-将config-service和admin-service注册到单独的eureka-server上)章节

> 注3：在多机房部署时，往往希望config service和admin service只向同机房的eureka注册，要实现这个效果，需要利用`ServerConfig`表中的cluster字段，config service和admin service会读取所在机器的`/opt/settings/server.properties`（Mac/Linux）或`C:\opt\settings\server.properties`（Windows）中的idc属性，如果该idc有对应的eureka.service.url配置，那么就只会向该机房的eureka注册。比如config service和admin service会部署到`SHAOY`和`SHAJQ`两个IDC，那么为了实现这两个机房中的服务只向该机房注册，那么可以在`ServerConfig`表中新增两条记录，分别填入`SHAOY`和`SHAJQ`两个机房的eureka地址即可，`default` cluster的记录可以保留，如果有config service和admin service不是部署在`SHAOY`和`SHAJQ`这两个机房的，就会使用这条默认配置。

| Key                | Cluster | Value                       | Comment              |
| ------------------ | ------- | --------------------------- | -------------------- |
| eureka.service.url | default | http://1.1.1.1:8080/eureka/ | 默认的Eureka服务Url  |
| eureka.service.url | SHAOY   | http://2.2.2.2:8080/eureka/ | SHAOY的Eureka服务Url |
| eureka.service.url | SHAJQ   | http://3.3.3.3:8080/eureka/ | SHAJQ的Eureka服务Url |

##### 2. namespace.lock.switch - 一次发布只能有一个人修改开关，用于发布审核

这是一个功能开关，如果配置为true的话，那么一次配置发布只能是一个人修改，另一个发布。

> 生产环境建议开启此选项

##### 3. config-service.cache.enabled - 是否开启配置缓存

这是一个功能开关，如果配置为true的话，config service会缓存加载过的配置信息，从而加快后续配置获取性能。

默认为false，开启前请先评估总配置大小并调整config service内存配置。

> 开启缓存后必须确保应用中配置的app.id大小写正确，否则将获取不到正确的配置

##### 4. item.key.length.limit - 配置项 key 最大长度限制

默认配置是128。

##### 5. item.value.length.limit - 配置项 value 最大长度限制

默认配置是20000。

## 2.2 获取安装包

可以通过两种方式获取安装包：

1. 直接下载安装包
   - 从[GitHub Release](https://github.com/ctripcorp/apollo/releases)页面下载预先打好的安装包
   - 如果对Apollo的代码没有定制需求，建议使用这种方式，可以省去本地打包的过程
2. 通过源码构建
   - 从[GitHub Release](https://github.com/ctripcorp/apollo/releases)页面下载Source code包或直接clone[源码](https://github.com/ctripcorp/apollo)后在本地构建
   - 如果需要对Apollo的做定制开发，需要使用这种方式

### 2.2.1 直接下载安装包

#### 2.2.1.1 获取apollo-configservice、apollo-adminservice、apollo-portal安装包

从[GitHub Release](https://github.com/ctripcorp/apollo/releases)页面下载最新版本的`apollo-configservice-x.x.x-github.zip`、`apollo-adminservice-x.x.x-github.zip`和`apollo-portal-x.x.x-github.zip`即可。

## 2.3 使用Docker部署Apollo服务端

```shell
mkdir -p /opt/apollo/docker/apollo-configservice
mkdir -p /opt/apollo/docker/apollo-adminservice
mkdir -p /opt/apollo/docker/apollo-portal
```

## 2.3.1 部署apollo-configservice

```shell
# Dockerfile for apollo-configservice
# 1. Copy apollo-configservice-${VERSION}-github.zip to current directory
# 2. Build with: docker build -t apollo-configservice .
# 3. Run with: docker run --restart=always  -p 8080:8080 -e "EUREKA_INSTANCE_IP-ADDRESS=你的宿主机IP" -e DS_URL="jdbc:mysql://192.168.123.5:3306/ApolloConfigDB?characterEncoding=utf8" -e DS_USERNAME=root -e DS_PASSWORD=root -d -v /tmp/logs:/opt/logs --name apollo-configservice apollo-configservice

FROM openjdk:8-jre-alpine
MAINTAINER ameizi <sxyx2008@163.com>

ENV VERSION 1.5.1
ENV SERVER_PORT 8080
# DataSource Info
ENV DS_URL ""
ENV DS_USERNAME ""
ENV DS_PASSWORD ""

RUN echo "http://mirrors.aliyun.com/alpine/v3.8/main" > /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.8/community" >> /etc/apk/repositories \
    && apk update upgrade \
    && apk add --no-cache procps unzip curl bash tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

ADD apollo-configservice-${VERSION}-github.zip /apollo-configservice/apollo-configservice-${VERSION}-github.zip

RUN unzip /apollo-configservice/apollo-configservice-${VERSION}-github.zip -d /apollo-configservice \
    && rm -rf /apollo-configservice/apollo-configservice-${VERSION}-github.zip \
    && sed -i '$d' /apollo-configservice/scripts/startup.sh \
    && chmod +x /apollo-configservice/scripts/startup.sh \
    && echo "tail -f /dev/null" >> /apollo-configservice/scripts/startup.sh

EXPOSE $SERVER_PORT

CMD ["/apollo-configservice/scripts/startup.sh"]
```

## 2.3.2 部署apollo-adminservice

```shell
# Dockerfile for apollo-adminservice
# 1. Copy apollo-adminservice-${VERSION}-github.zip to current directory
# 2. Build with: docker build -t apollo-adminservice .
# 3. Run with: docker run --restart=always -p 8090:8090 -e "EUREKA_INSTANCE_IP-ADDRESS=你的宿主机IP" -e DS_URL="jdbc:mysql://192.168.123.5:3306/ApolloConfigDB?characterEncoding=utf8" -e DS_USERNAME=root -e DS_PASSWORD=root -d -v /tmp/logs:/opt/logs --name apollo-adminservice apollo-adminservice

FROM openjdk:8-jre-alpine
MAINTAINER ameizi <sxyx2008@163.com>

ENV VERSION 1.5.1
ENV SERVER_PORT 8090
# DataSource Info
ENV DS_URL ""
ENV DS_USERNAME ""
ENV DS_PASSWORD ""

RUN echo "http://mirrors.aliyun.com/alpine/v3.8/main" > /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.8/community" >> /etc/apk/repositories \
    && apk update upgrade \
    && apk add --no-cache procps unzip curl bash tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

ADD apollo-adminservice-${VERSION}-github.zip /apollo-adminservice/apollo-adminservice-${VERSION}-github.zip

RUN unzip /apollo-adminservice/apollo-adminservice-${VERSION}-github.zip -d /apollo-adminservice \
    && rm -rf /apollo-adminservice/apollo-adminservice-${VERSION}-github.zip \
    && sed -i '$d' /apollo-adminservice/scripts/startup.sh \
    && chmod +x /apollo-adminservice/scripts/startup.sh \
    && echo "tail -f /dev/null" >> /apollo-adminservice/scripts/startup.sh

EXPOSE $SERVER_PORT

CMD ["/apollo-adminservice/scripts/startup.sh"]
```

## 2.3.3 部署apollo-portal

```shell
# Dockerfile for apollo-portal
# 1. Copy apollo-portal-${VERSION}-github.zip to current directory
# 2. Build with: docker build -t apollo-portal .
# 3. Run with: docker run --restart=always -p 8070:8070 -e DS_URL="jdbc:mysql://192.168.123.5:3306/ApolloPortalDB?characterEncoding=utf8" -e DS_USERNAME=root -e DS_PASSWORD=root -e DEV_META=http://192.168.123.5:8080 -d -v /tmp/logs:/opt/logs --name apollo-portal apollo-portal

FROM openjdk:8-jre-alpine
MAINTAINER ameizi <sxyx2008@163.com>

ENV VERSION 1.6.0
ENV SERVER_PORT 8070
# DataSource Info
ENV DS_URL ""
ENV DS_USERNAME ""
ENV DS_PASSWORD ""
# Environmental variable declaration (meta server url, different environments should have different meta server addresses)
ENV DEV_META ""
ENV TEST_META ""
#ENV UAT_META ""
#ENV LPT_META ""
ENV PRO_META ""

RUN echo "http://mirrors.aliyun.com/alpine/v3.8/main" > /etc/apk/repositories \
    && echo "http://mirrors.aliyun.com/alpine/v3.8/community" >> /etc/apk/repositories \
    && apk update upgrade \
    && apk add --no-cache procps unzip curl bash tzdata \
    && ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone

ADD apollo-portal-${VERSION}-github.zip /apollo-portal/apollo-portal-${VERSION}-github.zip

RUN unzip /apollo-portal/apollo-portal-${VERSION}-github.zip -d /apollo-portal \
    && rm -rf /apollo-portal/apollo-portal-${VERSION}-github.zip \
    && sed -i '$d' /apollo-portal/scripts/startup.sh \
    && chmod +x /apollo-portal/scripts/startup.sh \
    && echo "tail -f /dev/null" >> /apollo-portal/scripts/startup.sh

EXPOSE $SERVER_PORT

CMD ["/apollo-portal/scripts/startup.sh"]
```

