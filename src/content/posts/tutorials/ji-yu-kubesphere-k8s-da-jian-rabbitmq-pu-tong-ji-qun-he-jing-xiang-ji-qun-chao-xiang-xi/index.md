---
title: "基于KubeSphere+k8s搭建rabbitmq普通集群和镜像集群 超详细"
published: 2020-10-16
description: "这里创建的有状态服务默认外网访问不了"
tags: ["KubeSphere","集群"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

#### 1.前提条件

- [准备好k8s环境](http://blog.tianch.xyz/archives/k8s%E9%9B%86%E7%BE%A4%E6%90%AD%E5%BB%BA)
- [准备好KubeSphere环境](http://blog.tianch.xyz/archives/kubesphere%E4%B9%8B-%E5%AE%89%E8%A3%85)

#### 2.创建存储卷（3个）

- 存储卷-创建-起名字-下一步

  ![1602819012753](./images/1602819012753.png)

  ![1602819054493](./images/1602819054493.png)
  - 存储类型默认 容量自行调整（我还用默认）

  ![1602819140832](./images/1602819140832.png)
  - 创建

  ![1602819168733](./images/1602819168733.png)

- 同样的操作再创建2个同样的存储卷

#### 3.创建rabbitmq节点（3个）

- 应用负载-服务-创建-有状态服务-起名字和描述-下一步

  ![1602817964794](./images/1602817964794.png)

  ![1602817999313](./images/1602817999313.png)

  ![1602818117163](./images/1602818117163.png)

- 添加容器镜像: rabbitmq:3.8.5-management
  - 3.8.5（不含）以上的版本我没创建成功，使用rabbitmqctl的各种命令都会有下面的提示

    ![1602818420543](./images/1602818420543.png)

  ![1602818199812](./images/1602818199812.png)

- 搜索镜像-使用默认端口
  - 高级设置根据个人需求进行设置

  ![1602818443932](./images/1602818443932.png)

- 设置容器环境变量（重要）

  ```properties
  #key=value()
  RABBITMQ_ERLANG_COOKIE=rabbitcookie
  ```

  ![1602818526243](./images/1602818526243.png)

- 下一步

  ![1602818923845](./images/1602818923845.png)

- 挂载存储-添加存储卷

  ![1602819530802](./images/1602819530802.png)

- 选择已有的存储卷（每个节点选一个存储卷）

  ![1602819586572](./images/1602819586572.png)
  - 挂载路径不能随便写 必须是/var/lib/rabbitmq

  ![1602819680271](./images/1602819680271.png)

- 下一步-创建

  ![1602819712241](./images/1602819712241.png)

  ![1602820892240](./images/1602820892240.png)

- 按照上面创建出另外两个节点

#### 4.设置MQ外网访问

这里创建的有状态服务默认外网访问不了

- 服务-创建-指定工作负载-起名字-下一步

  ![1602819980440](./images/1602819980440.png)

  ![1602819993652](./images/1602819993652.png)

  ![1602820058860](./images/1602820058860.png)

- 指定工作负载-有状态副本集-确定

  ![1602820123573](./images/1602820123573.png)

- 端口映射设置（暴露容器的15672端口）-下一步

  ![1602820579458](./images/1602820579458.png)

- 设置外网访问方式-创建

  ![1602820754672](./images/1602820754672.png)

- 另外两个如法炮制

- 使用外网IP:映射的端口就可以访问到单个rabbitmq节点了 默认账号密码 guest/guest

  ![1602827060802](./images/1602827060802.png)

  ![1602827088433](./images/1602827088433.png)

  ![1602827103703](./images/1602827103703.png)

  ![1602827117094](./images/1602827117094.png)

#### 5.单节点配置成普通集群

- 打开每个节点的终端（以node1为例）

  ![1602827899861](./images/1602827899861.png)

  ![1602827968074](./images/1602827968074.png)

  ![1602828003233](./images/1602828003233.png)

  ![1602828020681](./images/1602828020681.png)

- 更新容器 安装vim编辑器

  ```shell
  #安装vim是为了编辑hosts文件 安装ping是为了测试节点间的连通性
  apt-get update && apt-get install iputils-ping  && apt-get install vim
  #在低版本的容器中执行上面的命令可能会出现错误 需要在出现错误后执行下面的命令
  apt-get install -y apt-transport-https
  #注意：apt-get install -y apt-transport-https 改名了只能在更新命令出错后使用
  ```

- 设置每个节点的hosts文件
  - 查看每个节点的ip和主机名

    ![1602830033531](./images/1602830033531.png)

  - 编辑每个节点的/etc/hosts文件

    ```shell
    vim /etc/hosts
    ```

    在最后追加一下内容 ip和主机名用你自己的

    ```shell
    10.244.2.141 rabbitmq-node1-izty6d-0
    10.244.2.143 rabbitmq-node2-tu5b1b-0
    10.244.2.145 rabbitmq-node3-kzt58a-0
    ```

- 建立集群关系

  在节点2和节点3分别执行下面的命令
  - 先停掉mq进程

    ```shell
    rabbitmqctl stop_app
    ```

  - 重置mq节点（新安装的可以跳过）

    ```shell
    rabbitmqctl reset
    ```

  - 加入到主节点 @后面是主机名 主机名是你实际的主机名

    `  下面图中的disc标注了Rabbitmq节点类型。Rabbitmq中的每一个节点，不管是单一节点系统或者是集群中的一
部分要么是内存节点，要么是磁盘节点。内存节点将所有的队列，交换机，绑定关系、用户、权限和vhost的元数据定义都存储在内存中，而磁盘节点则将这些信息存储到磁盘中。单节点的集群中必然只有磁盘类型的节点，否则当重启Rabbitmq之后，所有关于系统配置信息都会丢失。不过在集群中，可以选择配置部分节点为内存节点，这样可以获得更高的性能  `

    `Rabbitmq只要求在集群中至少有一个磁盘节点，其他所有的节点可以是内存节点。当节点加入或者离开集群时，它们必须将变更通知到至少一个磁盘节点。如果只有一个磁盘节点，而且不凑巧它刚好崩溃了，那么集群可以继续接收和发送消息。但是不能执行创建队列，交换机，绑定关系、用户已经更改权限、添加和删除集群节点操作了。也就是说、如果集群中唯一的磁盘节点崩溃了，集群仍然可以保持运行，但是直到将该节点恢复到集群前，你无法更改任何东西，所以在创建集群的时候应该保证至少有两个或者多个磁盘节点。当内存节点重启后，它会连接到预先配置的磁盘节点，下载当前集群元数据的副本。当在集群中添加内存节点的时候，确保告知所有的磁盘节点（内存节点唯一存储到磁盘中的元数据信息是磁盘节点的地址）。只要内存节点可以找到集群中至少一个磁盘节点，那么它就能在重启后重新加入集群中。`

    ```shell
    #一个节点设置为磁盘节点
    rabbitmqctl join_cluster rabbit@rabbitmq-node1-izty6d-0
    #另外一个节点设置为内存节点 提升性能
    rabbitmqctl join_cluster --ram rabbit@rabbitmq-node1-izty6d-0
    ```

  - 已创建节点类型变更: rabbitmqctl change_cluster_node_type {disc , ram}

    ```shell
    # 关闭rabbitmq服务
    rabbitmqctl stop_app
    # 将root@rabbitmq-node02节点类型切换为内存节点
    rabbitmqctl change_cluster_node_type ram
    ```

  - 启动mq进程

    ```shell
    rabbitmqctl start_app
    ```

    ![1602830612262](./images/1602830612262.png)

    ![1602832886261](./images/1602832886261.png)

    至此 普通集群搭建完成

  - 查看节点状态

    ```shell
    rabbitmqctl status
    ```

  - 查看集群节点状态

    ```shell
    rabbitmqctl cluster_status
    ```

#### 6.给节点添加用户和角色 一个节点执行全部节点生效

- 添加用户，用户名为admin，密码为admin

```shell
rabbitmqctl add_user admin admin
```

- 查看rabbitmq的用户列表

  ```shell
  rabbitmqctl list_users
  ```

- admin用户已经添加成功，但是没有角色

  ![1602831681822](./images/1602831681822.png)

- 给admin用户设置管理员权限

```shell
rabbitmqctl set_user_tags admin administrator
```

- 其它命令

  ```shell
  rabbitmqctl delete_user admin # 删除admin用户
  rabbitmq-server -detached # 启动rabbitmq服务，该命令可以启动erlang虚拟机和rabbitmq服务
  ```

#### 7.给添加的用户(admin)设置Virtual Hosts访问权限

- 在`User`里面 新建的用户默认是没有任何Virtual Hosts的访问权限的

  ![1602838577519](./images/1602838577519.png)

- 设置访问权限

  ![1602838706088](./images/1602838706088.png)

  ![1602838733069](./images/1602838733069.png)

  ![1602838752787](./images/1602838752787.png)

#### 8.将普通集群设置为镜像集群

- 思考的问题
  - 1、为什么要存在镜像队列
    为了保证队列和消息的高可用
  - 2、什么是镜像队列，镜像队列是如何进行选取主节点的？
    引入镜像队列的机制，可以将队列镜像到集群中的其他的Broker节点之上，如果集群中的一个节点失效了，队列能自动的切换到镜像中的另一个节点之上以保证服务的可用性。在通常的用法中，针对每一个配置镜像的队列（一下称之为镜像队列）都包含一个主节点(master)和若干个从节点(slave)。slave会准确地按照master执行命令顺序进行动作，故slave和master上维护的状态应该也是相同的。如果
    master由于某种原因宕机了，那么"资源最老"的slave会被提升为新的master。根据slave加入的时间排序，时间最长的slave即为"资历最老"。发送到镜像队列的所有的消息会被同时发往master和所有的slave，如果此时master挂掉了，消息还会在slave上，这样slave提升为master的时候消息也不会丢失。

- 镜像集群配置
  - 方式一：通过命令行设置

    针对某一个队列去配置其对应的镜像其实比较简单，我们只需要去添加一个镜像策略即可：

    ```shell
    rabbitmqctl set_policy [-p <vhost>] [--priority <priority>] [--apply-to <apply-to>] <name> <pattern> <definition>
    ```

    ```shell
    #设置/交换机的策略名称为ha 对所有队列生效  镜像队列模式为节点 镜像队列消息的同步方式为automatic
    rabbitmqctl set_policy -p / ha "^" '{"ha-mode":"all","ha-sync-mode":"automatic"}'
    ```

    ![image-20201018175458781](./images/image-20201018175458781.png)

    ![image-20201018175533620](./images/image-20201018175533620.png)

  - 方式二：通过后台管理设置

    ![image-20201018175916314](./images/image-20201018175916314.png)

    ![image-20201018175929150](./images/image-20201018175929150.png)

    打完收工！

