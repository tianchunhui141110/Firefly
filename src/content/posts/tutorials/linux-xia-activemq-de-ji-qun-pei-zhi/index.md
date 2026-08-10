---
title: "Linux下ActiveMQ的集群配置"
published: 2020-06-13
description: "自从activemq5.9.0开始，activemq的集群实现方式取消了传统的Pure Master Slave方式，增加了基于zookeeper+leveldb的实现方式，其他两种方式：目录共享和数据库共享依然存在。"
tags: ["Linux","ActiveMQ","集群"]
category: "中间件"
draft: false
lang: zh_CN
---

`自从activemq5.9.0开始，activemq的集群实现方式取消了传统的Pure Master Slave方式，增加了基于zookeeper+leveldb的实现方式，其他两种方式：目录共享和数据库共享依然存在。 `

- ##### Master-Slave部署方式
  - Shared Filesystem Master-Slave方式

    `支持N个AMQ实例组网，但由于他是基于kahadb存储策略，亦可以部署在分布式文件系统上，应用灵活、高效且安全,部署方式主要是通过共享存储目录来实现master和slave的热备，所有的ActiveMQ应用都在不断地获取共享目录的控制权，哪个应用抢到了控制权，它就成为master,多个共享存储目录的应用，谁先启动，谁就可以最早取得共享目录的控制权成为master，其他的应用就只能作为slave。`

  - Shared Database Master-Slave方式

    `与shared filesystem方式类似，只是共享的存储介质由文件系统改成了数据库而已，支持N个AMQ实例组网，但他的性能会受限于数据库`

  - Replicated LevelDB Store方式

    `ActiveMQ5.9以后才新增的特性，使用ZooKeeper协调选择一个node作为master。被选择的master broker node开启并接受客户端连接。 
其他node转入slave模式，连接master并同步他们的存储状态。slave不接受客户端连接。所有的存储操作都将被复制到连接至Master的slaves。 
如果master死了，得到了最新更新的slave被允许成为master。fialed node能够重新加入到网络中并连接master进入slave mode。所有需要同步的disk的消息操作都将等待存储状态被复制到其他法定节点的操作完成才能完成。所以，如果你配置了replicas=3，那么法定大小是(3/2)+1=2. Master将会存储并更新然后等待 (2-1)=1个slave存储和更新完成，才汇报success。至于为什么是2-1，熟悉Zookeeper的应该知道，有一个node要作为观擦者存在。 
单一个新的master被选中，你需要至少保障一个法定node在线以能够找到拥有最新状态的node。这个node将会成为新的master。因此，推荐运行至少3个replica nodes，以防止一个node失败了，服务中断`

- ##### 下载activeMQ解压并复制3份

  ```shell
  wget https://mirror.olnevhost.net/pub/apache//activemq/5.15.13/apache-activemq-5.15.13-bin.tar.gz
  ```

  ```shell
  tar -xvf apache-activemq-5.15.13-bin.tar.gz
  ```

  ```shell
  cp -R apache-activemq-5.15.13-bin  apache-activemq-1
  cp -R apache-activemq-5.15.13-bin  apache-activemq-2
  cp -R apache-activemq-5.15.13-bin  apache-activemq-3
  ```

- 修改配置文件
  - activemq.xml

    ```xml
    <!-- 3个文件的broker修改要一致  dataDirectory是数据存储共享目录地址-->
    <broker xmlns="http://activemq.apache.org/schema/core" brokerName="hamq" dataDirectory="/opt/activemq-cluster/sharedb">
    ```

    ![image-20200613214116195](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200613214116195.png)

    ```xml
    <!-- 修改kahaDB共享目录地址 -->
    <persistenceAdapter>
        <kahaDB directory="/opt/activemq-cluster/kahadb"/>
    </persistenceAdapter>
    ```

    ![image-20200613214426995](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200613214426995.png)

    ```xml
    <!-- 修改openwire的tcp连接地址端口分别为 61616 61626 61636 其它协议没用到可以注释掉 -->
    <transportConnectors>
        <!-- DOS protection, limit concurrent connections to 1000 and frame size to 100MB -->
        <transportConnector name="openwire" uri="tcp://0.0.0.0:61616?maximumConnections=1000&amp;wireFormat.maxFrameSize=104857600"/>
        <!--
                <transportConnector name="amqp" uri="amqp://127.0.0.1:5672?maximumConnections=1000&amp;wireFormat.maxFrameSize=104857600"/>
                <transportConnector name="stomp" uri="stomp://127.0.0.1:61613?maximumConnections=1000&amp;wireFormat.maxFrameSize=104857600"/>
                <transportConnector name="mqtt" uri="mqtt://127.0.0.1:1883?maximumConnections=1000&amp;wireFormat.maxFrameSize=104857600"/>
                <transportConnector name="ws" uri="ws://127.0.0.1:61614?maximumConnections=1000&amp;wireFormat.maxFrameSize=104857600"/>
                -->
    </transportConnectors>

    ```

    ![image-20200613214613498](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200613214613498.png)

    ```xml
    <!-- 添加访问ActiveMQ的账号密码 -->
    <plugins>
        <simpleAuthenticationPlugin>
            <users>
                <authenticationUser username="admin" password="admin" groups="users,admins"/>
            </users>
        </simpleAuthenticationPlugin>
    </plugins>
    ```

    ![image-20200613215005962](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200613215005962.png)

  - jetty.xml

    ```shell
    <!-- 分别修改 端口为 8161 8162 8163  -->
    <bean id="jettyPort" class="org.apache.activemq.web.WebConsolePort" init-method="start">
    <!-- the default port number for the web console -->
    <property name="host" value="0.0.0.0"/>
    <property name="port" value="8161"/>
    </bean>
    ```

    ![image-20200613215350577](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200613215350577.png)

  - jetty-realm.properties

    ```properties
    # 此配置文件是设置访问控制台的 角色 用户名 密码
    # Defines users that can access the web (console, demo, etc.)
    # username: password [,rolename ...]
    admin: admin1234, admin
    user: user1234, user
    ```

- ##### 编写脚本

  ```shell
  # 可以编写一个脚本 启动时携带参数 start stop restart
  cd /opt/activemq-cluster
  touch startmq.sh
  touch stopmq.sh
  touch restartmq.sh
  ```

  - 启动脚本

    ```shell
    cd /opt/activemq-cluster/apache-activemq-1/bin
    ./activemq start
    cd /opt/activemq-cluster/apache-activemq-2/bin
    ./activemq start
    cd /opt/activemq-cluster/apache-activemq-3/bin
    ./activemq start
    ```

  - 停止脚本

    ```shell

    cd /opt/activemq-cluster/apache-activemq-1/bin
    ./activemq stop
    cd /opt/activemq-cluster/apache-activemq-2/bin
    ./activemq stop
    cd /opt/activemq-cluster/apache-activemq-3/bin
    ./activemq stop
    ```

  - 重启脚本

    ```shell

    cd /opt/activemq-cluster/apache-activemq-1/bin
    ./activemq restart
    cd /opt/activemq-cluster/apache-activemq-2/bin
    ./activemq restart
    cd /opt/activemq-cluster/apache-activemq-3/bin
    ./activemq restart
    ```

- 赋予脚本可执行权限

  ```shell
  chmod 755 startmq.sh stopmq.sh restartmq.sh
  ```

- ##### 启动 成功了一个后面的将阻塞等待获取锁

  ```shell
  ./start.sh
  ```

  ![image-20200613220855875](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20200613220855875.png)

  `61626抢到了锁 另外两个节点成功slave节点 等待获取锁`

