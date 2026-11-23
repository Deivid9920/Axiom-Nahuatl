'use client'

/*
 * ===================== TRANSICIÓN DE LIANA + NUBES CARTOON (Framer Motion) =====================
 * Al entrar a una isla desde el Mundo:
 *   1. Dos bancos de nubes estilo caricatura 1930s / Cuphead (contorno grueso en tinta
 *      cacao #2D2A26, relleno crema cálido y sombras cel-shaded) cubren la pantalla.
 *   2. Axi el lémur cruza colgado de una liana verde de DERECHA a IZQUIERDA.
 *   3. Detrás de él, las nubes caricatura se abren hacia izquierda y derecha revelando la isla.
 */

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { AXI_VINE_DATA_URI } from '@/lib/world/axi-mascot-svg'

interface LemurVineTransitionProps {
  onMidpoint: () => void
  onComplete: () => void
}

function CartoonCloudBank({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 720 900"
      preserveAspectRatio="none"
      className="w-full h-full overflow-visible"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      {/* Capa trasera de nubes caricatura con contorno tinta cacao */}
      <g fill="#E5D9C3" stroke="#2D2A26" strokeWidth="6" strokeLinejoin="round">
        <path
          d="M -20 -20 L 570 -20
             C 665 10, 690 115, 625 185
             C 715 245, 705 370, 615 430
             C 705 505, 695 635, 610 700
             C 685 775, 650 885, 560 920
             L -20 920 Z"
        />
      </g>

      {/* Capa frontal esponjosa estilo Cuphead con bordes gruesos en tinta */}
      <g fill="#FAF3E7" stroke="#2D2A26" strokeWidth="6.5" strokeLinejoin="round">
        <path
          d="M -20 -20 L 495 -20
             C 575 18, 595 110, 535 170
             C 620 225, 618 338, 538 398
             C 625 462, 622 588, 540 652
             C 612 715, 595 845, 505 920
             L -20 920 Z"
        />
      </g>

      {/* Sombra interior cel-shaded cálida + rizos caricatura vintage */}
      <g fill="none" stroke="#D5C5AA" strokeWidth="7" strokeLinecap="round">
        <path d="M 420 118 Q 470 148 518 134" />
        <path d="M 438 330 Q 495 362 544 344" />
        <path d="M 426 575 Q 488 610 542 590" />
        <path d="M 405 795 Q 465 826 512 806" />
      </g>

      {/* Pequeños rizos de tinta estilo caricatura 1930s */}
      <g fill="none" stroke="#2D2A26" strokeWidth="4.5" strokeLinecap="round" opacity="0.72">
        <path d="M 355 185 C 385 168, 418 182, 412 208 C 406 228, 384 230, 378 214" />
        <path d="M 340 465 C 374 446, 410 462, 404 490 C 398 512, 374 514, 366 496" />
        <path d="M 350 718 C 380 702, 410 716, 404 740 C 398 758, 378 760, 372 746" />
      </g>

      {/* Nubecita suelta de acento en el borde */}
      <g fill="#FAF3E7" stroke="#2D2A26" strokeWidth="5.5" strokeLinejoin="round">
        <path
          d="M 595 258
             C 595 232, 632 224, 646 244
             C 666 238, 686 256, 678 278
             C 686 296, 668 312, 646 308
             C 628 316, 602 308, 602 290
             C 586 284, 586 264, 595 258 Z"
        />
        <path
          d="M 588 618
             C 588 594, 622 586, 636 604
             C 656 598, 674 616, 666 636
             C 674 654, 656 668, 636 664
             C 618 672, 594 664, 594 646
             C 578 640, 578 624, 588 618 Z"
        />
      </g>
    </svg>
  )
}

export function LemurVineTransition({ onMidpoint, onComplete }: LemurVineTransitionProps) {
  useEffect(() => {
    const midTimer = setTimeout(onMidpoint, 120)
    const endTimer = setTimeout(onComplete, 1850)
    return () => {
      clearTimeout(midTimer)
      clearTimeout(endTimer)
    }
  }, [onMidpoint, onComplete])

  const overlay = (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 1200 }}
      aria-hidden="true"
    >
      {/* Banco de nubes cartoon IZQUIERDO */}
      <motion.div
        className="absolute top-0 bottom-0 left-0 w-[64vw]"
        initial={{ x: '-105%' }}
        animate={{ x: ['-105%', '0%', '0%', '-118%'] }}
        transition={{
          duration: 1.8,
          times: [0, 0.14, 0.56, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <CartoonCloudBank />
      </motion.div>

      {/* Banco de nubes cartoon DERECHO */}
      <motion.div
        className="absolute top-0 bottom-0 right-0 w-[64vw]"
        initial={{ x: '105%' }}
        animate={{ x: ['105%', '0%', '0%', '118%'] }}
        transition={{
          duration: 1.8,
          times: [0, 0.14, 0.48, 1],
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <CartoonCloudBank flip />
      </motion.div>

      {/* Liana de selva + Axi balanceándose de DERECHA a IZQUIERDA */}
      <motion.div
        className="absolute top-[-10vh] left-1/2 -translate-x-1/2 origin-top flex flex-col items-center"
        initial={{ x: '72vw', rotate: -34 }}
        animate={{
          x: ['72vw', '14vw', '-22vw', '-84vw'],
          rotate: [-34, -2, 20, 38],
        }}
        transition={{
          duration: 1.28,
          delay: 0.36,
          times: [0, 0.35, 0.78, 1],
          ease: [0.25, 0.85, 0.35, 1],
        }}
      >
        {/* Liana verde estilo cartoon con borde tinta grueso */}
        <svg width="70" height="460" viewBox="0 0 70 460" className="overflow-visible -mb-8">
          <path
            d="M 35 0 Q 29 120 38 240 T 35 460"
            fill="none"
            stroke="#2D2A26"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M 35 0 Q 29 120 38 240 T 35 460"
            fill="none"
            stroke="#5D8458"
            strokeWidth="7.5"
            strokeLinecap="round"
          />
          {[90, 175, 260, 345, 410].map((y, idx) => (
            <ellipse
              key={y}
              cx={idx % 2 === 0 ? 22 : 48}
              cy={y}
              rx="14"
              ry="7"
              transform={`rotate(${idx % 2 === 0 ? -28 : 28} ${idx % 2 === 0 ? 22 : 48} ${y})`}
              fill={idx % 2 === 0 ? '#6B8E6A' : '#89A874'}
              stroke="#2D2A26"
              strokeWidth="2.8"
            />
          ))}
        </svg>

        <img
          src={AXI_VINE_DATA_URI}
          alt=""
          className="w-[170px] h-[178px] drop-shadow-[0_12px_16px_rgba(45,42,38,0.34)]"
          draggable={false}
        />
      </motion.div>
    </div>
  )

  if (typeof document === 'undefined') return overlay
  return createPortal(overlay, document.body)
}
