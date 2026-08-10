---
title: "您尚未安装任何 GPG 公钥出现rpm --import public.gpg.key,解决办法"
published: 2026-01-05
description: ""
tags: ["运维"]
category: "其他"
draft: false
lang: zh_CN
---

#### 解决办法

```shell
rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-CentOS-7
```

然后执行

```shell
yum install xxx
```

