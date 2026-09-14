import {
  Noto_Sans_Thai,
  Noto_Serif_Thai,
  Prompt,
  Sarabun,
} from 'next/font/google'

export const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'optional',
})

export const notoSerifThai = Noto_Serif_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '700'],
  variable: '--font-noto-serif-thai',
  display: 'optional',
})

export const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['400', '700'],
  variable: '--font-sarabun',
  display: 'optional',
})

export const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['400', '700'],
  variable: '--font-prompt',
  display: 'optional',
})
