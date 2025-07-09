import React from 'react'
import { Transition } from '@headlessui/react'

interface FormTransitionProps {
  show: boolean
  children: React.ReactNode
}

export const FormTransition: React.FC<FormTransitionProps> = ({ show, children }) => {
  return (
    <Transition
      show={show}
      enter="transition ease-out duration-300"
      enterFrom="transform opacity-0 scale-95"
      enterTo="transform opacity-100 scale-100"
      leave="transition ease-in duration-200"
      leaveFrom="transform opacity-100 scale-100"
      leaveTo="transform opacity-0 scale-95"
    >
      {children}
    </Transition>
  )
}