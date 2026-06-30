---
title: 渲染能力演示
description: 验证代码高亮、数学公式等渲染是否正常
---

本页用来验证文档区的各项渲染能力。

## 代码高亮

```c
// 配置 STM32 GPIO 为推挽输出
void gpio_init(void) {
    RCC->AHB1ENR |= RCC_AHB1ENR_GPIOAEN;   // 使能 GPIOA 时钟
    GPIOA->MODER &= ~(0x3 << (5 * 2));
    GPIOA->MODER |=  (0x1 << (5 * 2));      // PA5 = 输出
}
```

## 数学公式（KaTeX）

一阶 RC 低通滤波器的截止频率：

$$
f_c = \frac{1}{2\pi R C}
$$

行内公式也可以，比如采样定理要求 $f_s > 2 f_{max}$。

## 提示框

:::tip[小技巧]
Starlight 自带提示框语法，写文档很顺手。
:::

:::caution
这是一条警告提示。
:::
