---
title: "使用kubeKey安装k8s+kubesphere"
published: 2022-01-23
description: "以下内容均参考kubesphere官网"
tags: ["k8s"]
category: "Kubernetes"
draft: false
lang: zh_CN
---

以下内容均参考[kubesphere官网](https://kubesphere.io)

### 1.准备主机(略)

### 2.下载kubeKey

1. 如果网络不能访问GitHub,务必执行下面的命令

   ```shell
   export KKZONE=cn
   ```

2. 下载kubeKey

   ```shell
   curl -sfL https://get-kk.kubesphere.io | VERSION=v1.2.1 sh -
   ```

3. 添加可执行权限

   ```shell
   chmod +x kk
   ```

### 3.创建集群

1. 创建配置文件

   ```shell
   ./kk create config --with-kubesphere v3.2.1 --with-kubernetes v1.21.5 -f config-sample.yaml
   ```

2. 编辑调整配置文件-以下内容来自官网(仅供参考)

   ```yaml
   #vi ~/config-sample.yaml
   apiVersion: kubekey.kubesphere.io/v1alpha1
   kind: Cluster
   metadata:
     name: config-sample
     spec:
       hosts:
       - {name: master1, address: 172.24.107.72, internalAddress: 172.24.107.72, user: root, password: QWEqwe123}
       - {name: master2, address: 172.24.107.73, internalAddress: 172.24.107.73, user: root, password: QWEqwe123}
       - {name: master3, address: 172.24.107.74, internalAddress: 172.24.107.74, user: root, password: QWEqwe123}
       - {name: node1, address: 172.24.107.75, internalAddress: 172.24.107.75, user: root, password: QWEqwe123}
       - {name: node2, address: 172.24.107.76, internalAddress: 172.24.107.76, user: root, password: QWEqwe123}
       - {name: node3, address: 172.24.107.77, internalAddress: 172.24.107.77, user: root, password: QWEqwe123}
       roleGroups:
         etcd:
         - master1
         - master2
         - master3
         master:
         - master1
         - master2
         - master3
         worker:
         - node1
         - node2
         - node3
       controlPlaneEndpoint:
         domain: lb.kubesphere.local
         address: "39.104.82.170"
         port: 6443
       kubernetes:
         version: v1.17.9
         imageRepo: kubesphere
         clusterName: cluster.local
         masqueradeAll: false  # masqueradeAll tells kube-proxy to SNAT everything if using the pure iptables proxy mode. [Default: false]
         maxPods: 110  # maxPods is the number of pods that can run on this Kubelet. [Default: 110]
         nodeCidrMaskSize: 24  # internal network node size allocation. This is the size allocated to each node on your network. [Default: 24]
         proxyMode: ipvs  # mode specifies which proxy mode to use. [Default: ipvs]
       network:
         plugin: calico
         calico:
           ipipMode: Always  # IPIP Mode to use for the IPv4 POOL created at start up. If set to a value other than Never, vxlanMode should be set to "Never". [Always | CrossSubnet | Never] [Default: Always]
           vxlanMode: Never  # VXLAN Mode to use for the IPv4 POOL created at start up. If set to a value other than Never, ipipMode should be set to "Never". [Always | CrossSubnet | Never] [Default: Never]
           vethMTU: 1440  # The maximum transmission unit (MTU) setting determines the largest packet size that can be transmitted through your network. [Default: 1440]
         kubePodsCIDR: 10.233.64.0/18
         kubeServiceCIDR: 10.233.0.0/18
       registry:
         registryMirrors: []
         insecureRegistries: []
       addons: []

   ···
   # 其它配置可以在安装后之后根据需要进行修改
   ```

3. 持久化存储配置-待研究 暂时默认(OpenEBS)

4. 安装集群

   ```shell
   ./kk create cluster -f config-sample.yaml
   ```

5. 查看 KubeSphere 安装日志

   ```shell
   kubectl logs -n kubesphere-system $(kubectl get pod -n kubesphere-system -l app=ks-install -o jsonpath='{.items[0].metadata.name}') -f
   ```

