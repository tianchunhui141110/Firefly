---
title: "Containerd命令行工具-nerdctl"
published: 2026-01-05
description: "习惯了使用 docker cli，ctr 使用起来可能还是不太顺手，为了能够让大家更好的转到 containerd 上面来，社区提供了一个新的命令行工具：nerdctl。nerdctl 是一个与 docker cli 风格兼容的 conta"
tags: ["Containerd"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

习惯了使用 docker cli，`ctr` 使用起来可能还是不太顺手，为了能够让大家更好的转到 containerd 上面来，社区提供了一个新的命令行工具：[nerdctl](https://github.com/containerd/nerdctl)。nerdctl 是一个与 docker cli 风格兼容的 containerd 客户端工具，而且直接兼容 docker compose 的语法的.

## 安装

```sh
wget https://github.com/containerd/nerdctl/releases/download/v1.6.2/nerdctl-1.6.2-linux-amd64.tar.gz
# 如果有限制，也可以替换成下面的 URL 加速下载
# wget https://download.fastgit.org/containerd/nerdctl/releases/download/v1.6.2/nerdctl-1.6.2-linux-amd64.tar.gz

# 最下化安装
tar Cxzvvf /usr/local/bin nerdctl-1.6.2-linux-amd64.tar.gz
```

![image-20231016101552884](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016101552884.png)

## 命令

- ### run

  `nerdctl run`和 `docker run` 类似 可以使用 `nerdctl run` 命令运行容器

  ```sh
  nerdctl run -d -p 80:80 --name=nginx --restart=always nginx:alpine
  ```

  ![image-20231016102757105](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016102757105.png)

- ### exec

  ```sh
  nerdctl exec -it nginx /bin/sh
  ```

  ![image-20231016103856190](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016103856190.png)

- ### ps

  使用 `nerdctl ps` 命令可以列出所有容器

  ```sh
  nerdctl ps
  ```

  ![image-20231016104003495](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016104003495.png)

  同样可以使用 `-a` 选项显示所有的容器列表，默认只显示正在运行的容器，不过需要注意的是 `nerdctl ps` 命令并没有实现 `docker ps` 下面的 `--filter`、`--format`、`--last`、`--size` 等选项

- ### inspect

  显示结果和 `docker inspect` 基本一致

  ```sh
  nerdctl inspect nginx
  ```

- ### logs

  --tail 5 : 从最后5行开始显示

  ```sh
  nerdctl logs -f nginx --tail 5
  ```

  ![image-20231016104515183](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016104515183.png)

- ### stop

  ```sh
  nerdctl stop nginx
  ```

  ![image-20231016104614294](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016104614294.png)

- ### rm

  ```sh
  nerdctl rm nginx
  ```

  ![image-20231016104726339](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016104726339.png)

  rm不能直接杀掉正在运行的容器 要想杀掉正在运行的容器需要加上`-f`强制删除

- images

  ```sh
  nerdctl images
  ```

  ![image-20231016104955438](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016104955438.png)

- ### pull

  ```sh
  nerdctl pull busybox
  ```

  ![image-20231016105131475](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016105131475.png)

- ### tag

  ```sh
  nerdctl tag busybox registry.cn-hangzhou.aliyuncs.com/tianchunhui/busybox:231016
  ```

  ![image-20231016105501575](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016105501575.png)

- ### push

  推送镜像之前也可以使用 `nerdctl login` 命令登录到镜像仓库，然后再执行 push 操作

  ```sh
  nerdctl push registry.cn-hangzhou.aliyuncs.com/tianchunhui/busybox:231016
  ```

  ![image-20231016105551521](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016105551521.png)

  ![image-20231016105623053](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016105623053.png)

- ### save

  ```sh
  nerdctl save -o busybox.tar.gz busybox:latest
  ```

  ![image-20231016105742772](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016105742772.png)

- ### rmi

  ```sh
  nerdctl rmi busybox
  ```

  ![image-20231016105920930](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016105920930.png)

- ### load

  使用 `-i` 或 `--input` 选项指定需要导入的压缩包

  ```sh
  nerdctl load -i busybox.tar.gz
  ```

  ![image-20231016110015340](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016110015340.png)

- ### build

  `ctr` 并没有构建镜像的命令，而现在又不使用 Docker 了， `nerdctl` 提供了 `nerdctl build` 这样的镜像构建命令
  1. 新建一个如下的`Dockerfile`文件

     ```dockerfile
     FROM nginx
     RUN echo 'Hello Nerdctl From Containerd' > /usr/share/nginx/html/index.html
     ```

  2. 在文件所在目录执行镜像构建命令

     ```sh
     nerdctl build -t nginx:nerdctl -f Dockerfile .
     ```

     ![image-20231016110417256](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016110417256.png)

     可以看到有一个错误提示，需要安装 `buildctl` 并运行 `buildkitd`，这是因为 `nerdctl build` 需要依赖 `buildkit` 工具

     [buildkit](https://github.com/moby/buildkit) 项目也是 Docker 公司开源的一个构建工具包，支持 OCI 标准的镜像构建。它主要包含以下部分:
     - 服务端 `buildkitd`：当前支持 runc 和 containerd 作为 worker，默认是 runc，我们这里使用 containerd
     - 客户端 `buildctl`：负责解析 Dockerfile，并向服务端 buildkitd 发出构建请求

     buildkit 是典型的 C/S 架构，客户端和服务端是可以不在一台服务器上，而 `nerdctl` 在构建镜像的时候也作为 `buildkitd` 的客户端，所以需要我们安装并运行 `buildkitd`。

  3. 安装 `buildkit`

     ```sh
     mkdir -p /opt/nerdctl
     cd /opt/nerdctl
     wget https://github.com/moby/buildkit/releases/download/v0.12.2/buildkit-v0.12.2.linux-amd64.tar.gz
     tar -zxvf buildkit-v0.12.2.linux-amd64.tar.gz
     cp buildctl /usr/local/bin
     cp buildkitd /usr/local/bin
     ```

     使用 Systemd 来管理 `buildkitd`，创建如下所示的 `systemd unit` 文件：

     ```
     vim /etc/systemd/system/buildkit.service


     [Unit]
     Description=BuildKit
     Documentation=https://github.com/moby/buildkit

     [Service]
     ExecStart=/usr/local/bin/buildkitd --oci-worker=false --containerd-worker=true

     [Install]
     WantedBy=multi-user.target
     ```

     启动 `buildkitd`

     ```sh
     systemctl daemon-reload
     systemctl enable buildkit --now
     systemctl status buildkit
     ```

     ![image-20231016134709582](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016134709582.png)

  4. 重新执行构建命令

     ```sh
     nerdctl build -t nginx:nerdctl -f Dockerfile .
     ```

     ![image-20231016135200764](https://tianch-blog.oss-cn-beijing.aliyuncs.com/img/image-20231016135200764.png)

  单机环境下使用 Docker Compose，在 containerd 模式下，也可以使用 `nerdctl` 来兼容该功能。同样可以使用 `nerdctl compose`、`nerdctl compose up`、`nerdctl compose logs`、`nerdctl compose build`、`nerdctl compose down` 等命令来管理 Compose 服务。这样使用 containerd、nerdctl 结合 buildkit 等工具就完全可以替代 docker 在镜像构建、镜像容器方面的管理功能了。

