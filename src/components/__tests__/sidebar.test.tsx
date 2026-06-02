import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Sidebar } from '../sidebar'

describe('Sidebar RBAC boundaries', () => {
  it('renders standard links for all roles', () => {
    render(
      <TooltipProvider>
        <Sidebar 
          userRole="member" 
          userName="Test User" 
          userEmail="test@test.com" 
          activeProjectId="proj-1" 
        />
      </TooltipProvider>
    )
    
    expect(screen.getByText('Sprint Board')).toBeInTheDocument()
    expect(screen.getByText('QBR Presentation')).toBeInTheDocument()
  })

  it('hides Admin and Config links for non-admins', () => {
    render(
      <TooltipProvider>
        <Sidebar 
          userRole="member" 
          userName="Test User" 
          userEmail="test@test.com" 
          activeProjectId="proj-1" 
        />
      </TooltipProvider>
    )
    
    expect(screen.queryByText('Team Management')).not.toBeInTheDocument()
    expect(screen.queryByText('Configurations')).not.toBeInTheDocument()
  })

  it('shows Admin and Config links for admins', () => {
    render(
      <TooltipProvider>
        <Sidebar 
          userRole="admin" 
          userName="Admin User" 
          userEmail="admin@test.com" 
          activeProjectId="proj-1" 
        />
      </TooltipProvider>
    )
    
    expect(screen.getByText('Team Management')).toBeInTheDocument()
    expect(screen.getByText('Configurations')).toBeInTheDocument()
  })

  it('hides project-specific admin links if no active project is selected', () => {
    render(
      <TooltipProvider>
        <Sidebar 
          userRole="admin" 
          userName="Admin User" 
          userEmail="admin@test.com" 
          // No activeProjectId provided
        />
      </TooltipProvider>
    )
    
    expect(screen.queryByText('Team Management')).not.toBeInTheDocument()
    expect(screen.queryByText('Configurations')).not.toBeInTheDocument()
  })
})
