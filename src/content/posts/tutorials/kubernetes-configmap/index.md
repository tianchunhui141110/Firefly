---
title: "Kubernetes-ConfigMap"
published: 2026-01-05
description: "对于应用的可变配置在 Kubernetes 中是通过一个 ConfigMap 资源对象来实现的，应用经常会有从配置文件、命令行参数或者环境变量中读取一些配置信息的需求，这些配置信息肯定不会直接写死到应用程序中去的，比如一个应用连接一个 re"
tags: ["Kubernetes"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

对于应用的可变配置在 Kubernetes 中是通过一个 `ConfigMap` 资源对象来实现的，应用经常会有从配置文件、命令行参数或者环境变量中读取一些配置信息的需求，这些配置信息肯定不会直接写死到应用程序中去的，比如一个应用连接一个 redis 服务，下一次想更换一个，还得重新去修改代码，重新制作一个镜像，这肯定是不可取的，而 `ConfigMap` 就提供了向容器中注入配置信息的能力，不仅可以用来保存单个属性，还可以用来保存整个配置文件，比如可以用来配置一个 redis 服务的访问地址，也可以用来保存整个 redis 的配置文件。

## 创建

`ConfigMap` 资源对象使用 `key-value` 形式的键值对来配置数据，这些数据可以在 Pod 里面使用，如下所示的资源清单：_cm-demo.yaml_

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm-demo
  namespace: default
data:
  data.1: hello
  data.2: world
  config: |
    property.1=value1
    property.2=value2
    property.3=value3
```

其中配置数据在 `data` 属性下面进行配置，前两个被用来保存单个属性，后面一个被用来保存一个配置文件。

可以看到 `config` 后面有一个竖线符 `|`，这在 yaml 中表示保留换行，每行的缩进和行尾空白都会被去掉，而额外的缩进会被保留。

```yaml
lines: |
  我是第一行
  我是第二行
    我是吴彦祖
      我是第四行
  我是第五行

# JSON
{"lines": "我是第一行\n我是第二行\n  我是吴彦祖\n     我是第四行\n我是第五行"}
```

除了竖线之外还可以使用 `>` 右尖括号，用来表示折叠换行，只有空白行才会被识别为换行，原来的换行符都会被转换成空格。

```yaml
lines: >
  我是第一行
  我也是第一行
  我仍是第一行
  我依旧是第一行

  我是第二行
  这么巧我也是第二行

# JSON
{"lines": "我是第一行 我也是第一行 我仍是第一行 我依旧是第一行\n我是第二行 这么巧我也是第二行"}
```

除了这两个指令之外，还可以使用竖线和加号或者减号进行配合使用，`+` 表示保留文字块末尾的换行，`-` 表示删除字符串末尾的换行。

```yaml
value: |
  hello

# {"value": "hello\n"}

value: |-
  hello

# {"value": "hello"}

value: |+
  hello

# {"value": "hello\n\n"} (有多少个回车就有多少个\n)
```

同样的可以使用`kubectl create -f xx.yaml`来创建上面的 `ConfigMap` 对象，如果不知道怎么创建 `ConfigMap` ，可以使用`kubectl create configmap -h`来查看关于创建 `ConfigMap` 的帮助信息：

```shell
Examples:
  # Create a new configmap named my-config based on folder bar
  kubectl create configmap my-config --from-file=path/to/bar

  # Create a new configmap named my-config with specified keys instead of file basenames on disk
  kubectl create configmap my-config --from-file=key1=/path/to/bar/file1.txt --from-file=key2=/path/to/bar/file2.txt

  # Create a new configmap named my-config with key1=config1 and key2=config2
  kubectl create configmap my-config --from-literal=key1=config1 --from-literal=key2=config2
```

可以看到可以从`testcm`的目录来创建一个 `ConfigMap` 对象，在`testcm`目录下面包含一些配置文件，redis 和 mysql 的连接信息，如下：

```sh
# redis.conf
host=127.0.0.1
port=6379

# mysql.conf
host=127.0.0.1
port=3306
```

然后就可以使用 `from-file` 关键字来创建包含这个目录下面所以配置文件的 `ConfigMap`：

```sh
kubectl create configmap cm-demo1 --from-file=xxx目录
```

其中 `from-file` 参数指定在`testcm`目录下面的所有文件都会被用在 `ConfigMap` 里面创建一个键值对，键的名字就是文件名，值就是文件的内容。创建完成后，同样可以使用如下命令来查看 `ConfigMap` 列表：

可以看到已经创建了一个 cm-demo1 的 `ConfigMap` 对象，然后可以使用 `describe` 命令查看详细信息：

```sh
kubectl describe cm cm-demo1 -n default
```

可以看到两个 `key` 是 testcm 目录下面的文件名称，对应的 `value` 值就是文件内容，这里值得注意的是如果文件里面的配置信息很大的话，`describe` 的时候可能不会显示对应的值，要查看完整的键值，可以使用如下命令：

```sh
kubectl get cm cm-demo1 -n default -o yaml
```

![image-20231106111529692](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106111531.png)

除了通过文件目录进行创建，也可以使用指定的文件进行创建 `ConfigMap`，同样的，以上面的配置文件为例，创建一个 redis 的配置的一个单独 `ConfigMap` 对象：

```sh
kubectl create configmap cm-demo2 --from-file=testcm/redis.conf
```

![image-20231106141102350](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106141104.png)

可以看到一个关联 redis.conf 文件配置信息的 `ConfigMap` 对象创建成功了，另外值得注意的是 `--from-file` 这个参数可以使用多次，比如使用两次分别指定 redis.conf 和 mysql.conf 文件，就和直接指定整个目录是一样的效果了。

另外，通过帮助文档可以看到还可以直接使用字符串进行创建，通过 `--from-literal` 参数传递配置信息，同样的，这个参数可以使用多次，格式如下：

```sh
kubectl create configmap cm-demo3 -n default --from-literal=db.host=localhost --from-literal=db.port=3306
```

![image-20231106141456031](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106141457.png)

## 使用

`ConfigMap` 创建成功后，这些配置数据可以通过很多种方式在 Pod 里使用，主要有以下几种方式：

- 设置环境变量的值
- 在容器里设置命令行参数
- 在数据卷里面挂载配置文件

首先使用 `ConfigMap` 来填充环境变量，如下所示的 Pod 资源对象：`testcm1-pod.yaml`

```yanl
apiVersion: v1
kind: Pod
metadata:
  name: testcm1-pod
spec:
  containers:
  - name: testcm1
    image: busybox
    command: ["/bin/sh", "-c", "env"]
    env:
    - name: DB_HOST
      valueFrom:
        configMapKeyRef:
          name: cm-demo3
          key: db.host
    - name: DB_PORT
      valueFrom:
        configMapKeyRef:
          name: cm-demo3
          key: db.port
    envFrom:
    - configMapRef:
        name: cm-demo1
    resources:
      limits:
        memory: "128Mi"
        cpu: "500m"
```

这个 Pod 运行后会输出如下所示的信息：

```sh
kubectl logs testcm1-pod -n default
```

![image-20231106142922739](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106142924.png)

可以看到 DB_HOST 和 DB_PORT 都已经正常输出了，另外的环境变量是因为这里直接把 cm-demo1 给注入进来了，所以把它们的整个键值给输出出来了，这也是符合预期的。

另外也可以使用 `ConfigMap`来设置命令行参数，`ConfigMap` 也可以被用来设置容器中的命令或者参数值，如下 Pod:_testcm2-pod.yaml_

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: testcm2-pod
spec:
  containers:
    - name: testcm2
      image: busybox
      command:
        - "/bin/sh"
        - "-c"
        - "echo $(DB_HOST) $(DB_PORT)"
      env:
        - name: DB_HOST
          valueFrom:
            configMapKeyRef:
              name: cm-demo3
              key: db.host
        - name: DB_PORT
          valueFrom:
            configMapKeyRef:
              name: cm-demo3
              key: db.port
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

![image-20231106143809538](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231106143809538.png)

另外一种是非常常见的使用 `ConfigMap` 的方式：通过**数据卷**使用，在数据卷里面使用 ConfigMap，就是将文件填入数据卷，在这个文件中，键就是文件名，键值就是文件内容，如下资源对象所示：_testcm3-pod.yaml_

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: testcm3-pod
spec:
  volumes:
    - name: config-volume
      configMap:
        name: cm-demo2
  containers:
    - name: testcm3
      image: busybox
      command:
        - "/bin/sh"
        - "-c"
        - "cat /etc/config/redis.conf"
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

![image-20231106144633482](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231106144633482.png)

也可以在 `ConfigMap` 值被映射的数据卷里去控制路径，如下 Pod 定义：_testcm4-pod.yaml_

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: testcm4-pod
spec:
  volumes:
    - name: config-volume
      configMap:
        name: cm-demo1
        items:
          - key: mysql.conf
            path: path/to/mysql.conf
  containers:
    - name: testcm4
      image: busybox
      command:
        - "/bin/sh"
        - "-c"
        - "cat /etc/config/path/to/mysql.conf"
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
      resources:
        limits:
          memory: "128Mi"
          cpu: "500m"
```

![image-20231106145708602](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/20231106145710.png)

另外需要注意的是，当 `ConfigMap` 以数据卷的形式挂载进 `Pod` 的时，这时更新 `ConfigMap（或删掉重建ConfigMap）`，Pod 内挂载的配置信息会热更新。这时可以增加一些监测配置文件变更的脚本，然后重加载对应服务就可以实现应用的热更新。

**使用注意**:只有通过 Kubernetes API 创建的 Pod 才能使用 `ConfigMap`，其他方式创建的（比如静态 Pod）不能使用；ConfigMap 文件大小限制为 `1MB`（ETCD 的要求）。

