import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Breadcrumbs } from '../breadcrumbs'

describe('Breadcrumbs Component', () => {
  it('renders nothing if items array is empty', () => {
    const { container } = render(<Breadcrumbs items={[]} />)
    // The nav should still exist but have no children
    expect(container.querySelector('nav')).toBeInTheDocument()
    expect(container.querySelector('nav')?.childNodes.length).toBe(0)
  })

  it('renders a single item without a chevron separator', () => {
    render(<Breadcrumbs items={[{ label: 'Home' }]} />)
    
    expect(screen.getByText('Home')).toBeInTheDocument()
    // It should not render any ChevronRight icons if it's the last/only item
    expect(document.querySelector('.lucide-chevron-right')).not.toBeInTheDocument()
  })

  it('renders multiple items with href links and separators', () => {
    render(
      <Breadcrumbs 
        items={[
          { label: 'Home', href: '/home' },
          { label: 'Settings' }
        ]} 
      />
    )
    
    const homeLink = screen.getByRole('link', { name: 'Home' })
    expect(homeLink).toHaveAttribute('href', '/home')
    
    // The last item does not get an href even if passed, wait - actually it might?
    // Let's verify the component logic: isLast doesn't render Link.
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    
    // One chevron should be rendered
    expect(document.querySelectorAll('.lucide-chevron-right')).toHaveLength(1)
  })

  it('renders optional icons based on string mapping', () => {
    render(
      <Breadcrumbs 
        items={[
          { label: 'Dashboard', icon: 'Home' }
        ]} 
      />
    )
    
    // The icon mapping uses Lucide Home icon, which will render an SVG
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})
