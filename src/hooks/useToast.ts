'use client'

import toast from 'react-hot-toast'

/**
 * Custom hook for toast notifications
 * Provides consistent styling across the app
 */
export function useToast() {
  return {
    success: (message: string) => {
      toast.success(message, {
        duration: 4000,
        style: {
          background: '#10B981',
          color: '#fff',
          fontWeight: '500',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10B981',
        },
      })
    },

    error: (message: string) => {
      toast.error(message, {
        duration: 5000,
        style: {
          background: '#EF4444',
          color: '#fff',
          fontWeight: '500',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#EF4444',
        },
      })
    },

    info: (message: string) => {
      toast(message, {
        duration: 4000,
        icon: 'ℹ️',
        style: {
          background: '#6366F1',
          color: '#fff',
          fontWeight: '500',
        },
      })
    },

    warning: (message: string) => {
      toast(message, {
        duration: 4500,
        icon: '⚠️',
        style: {
          background: '#F59E0B',
          color: '#fff',
          fontWeight: '500',
        },
      })
    },

    /**
     * Show a promise-based toast (loading → success/error)
     */
    promise: <T,>(
      promise: Promise<T>,
      messages: {
        loading: string
        success: string
        error: string
      }
    ) => {
      return toast.promise(promise, messages, {
        style: {
          minWidth: '200px',
        },
        success: {
          style: {
            background: '#10B981',
            color: '#fff',
          },
        },
        error: {
          style: {
            background: '#EF4444',
            color: '#fff',
          },
        },
      })
    },

    /**
     * Dismiss all toasts
     */
    dismiss: () => toast.dismiss(),

    /**
     * Dismiss a specific toast by ID
     */
    dismissById: (id: string) => toast.dismiss(id),
  }
}

/**
 * Standalone toast functions for use outside React components
 */
export const showToast = {
  success: (message: string) => {
    toast.success(message, {
      duration: 4000,
      style: {
        background: '#10B981',
        color: '#fff',
        fontWeight: '500',
      },
    })
  },

  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
      style: {
        background: '#EF4444',
        color: '#fff',
        fontWeight: '500',
      },
    })
  },

  info: (message: string) => {
    toast(message, {
      duration: 4000,
      icon: 'ℹ️',
      style: {
        background: '#6366F1',
        color: '#fff',
        fontWeight: '500',
      },
    })
  },

  warning: (message: string) => {
    toast(message, {
      duration: 4500,
      icon: '⚠️',
      style: {
        background: '#F59E0B',
        color: '#fff',
        fontWeight: '500',
      },
    })
  },
}
