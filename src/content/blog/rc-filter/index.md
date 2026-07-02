---
title: 一阶 RC 低通滤波器的直觉理解
date: 2026-06-28
description: 从时域和频域两个角度理解 RC 低通，附截止频率推导。
tags:
  - 模拟电路
  - DSP
---

RC 低通滤波器是嵌入式里最常见的电路之一，去抖、平滑 ADC 采样都用得上。

## 截止频率

$$
f_c = \frac{1}{2\pi R C}
$$

当输入信号频率远低于 $f_c$ 时几乎无衰减；远高于 $f_c$ 时按 $-20,\text{dB/decade}$ 衰减。

## 离散实现

在 MCU 上常用一阶 IIR 近似：

```c
// alpha 越小，滤波越强（截止频率越低）
float lpf(float x, float prev, float alpha) {
    return prev + alpha * (x - prev);
}
```

其中 $\alpha = \frac{T_s}{T_s + RC}$，$T_s$ 为采样周期。
