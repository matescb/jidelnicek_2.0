#!/bin/bash

# Install missing Radix UI dependencies for the UI components
npm install --save \
  @radix-ui/react-separator \
  @radix-ui/react-avatar \
  @radix-ui/react-scroll-area \
  @radix-ui/react-dropdown-menu \
  embla-carousel-react

echo "UI dependencies installed successfully!"