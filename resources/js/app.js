import Alpine from 'alpinejs'

Alpine.data('alert', function (config = {}) {
  return {
    isVisible: false,
    // Read the autoDismiss boolean passed from Edge (defaults to false)
    autoDismiss: config.autoDismiss ?? false,

    dismiss() {
      this.isVisible = false
    },

    init() {
      // Smooth fade/slide in
      setTimeout(() => {
        this.isVisible = true
      }, 80)

      // Only start the timer if autoDismiss is explicitly true
      if (this.autoDismiss) {
        setTimeout(() => {
          this.dismiss()
        }, 8000)
      }
    },
  }
})

Alpine.start()
