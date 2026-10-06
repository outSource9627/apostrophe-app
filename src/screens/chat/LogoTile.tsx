import React from 'react'
import { CompanyTile } from '../../components/chat'

/**
 * A company's tile on Interests and Connections — the same rounded square, in
 * the same pastel pair, as the company's chat plate, so one company looks the
 * same everywhere. Tolerates a missing name.
 */
export function LogoTile({ name, size = 44 }: { name?: string | null; size?: number }) {
  return <CompanyTile name={name} size={size} />
}
