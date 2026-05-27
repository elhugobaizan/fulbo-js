import { X } from 'lucide-react'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  maxHeight?: string
  maxWidth?: string
}

export function Modal({ title, onClose, children, maxHeight = '80vh', maxWidth = 'max-w-sm' }: ModalProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pointer-events-none">
        <div
          className={`bg-gray-900 rounded-2xl border border-gray-800 w-full ${maxWidth} pointer-events-auto`}
          style={{ maxHeight }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-800">
            <span className="font-semibold text-white text-sm">{title}</span>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: `calc(${maxHeight} - 60px)` }}>
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
