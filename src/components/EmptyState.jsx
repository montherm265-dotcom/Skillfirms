import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1];

// An empty page still looks cared for: a glowing blue tile with two slow
// rings, a clear title and one next step.
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <motion.div
      className="mx-auto flex max-w-md flex-col items-center py-16 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      {Icon && (
        <span className="relative mb-6 flex h-20 w-20 items-center justify-center">
          <span aria-hidden className="absolute inset-[-18px] rounded-[2rem] border border-[#1f4189]/10" style={{ animation: "tf-float 6s ease-in-out infinite" }} />
          <span aria-hidden className="absolute inset-[-36px] rounded-[2.6rem] border border-dashed border-[#1f4189]/10" />
          <span aria-hidden className="absolute inset-0 rounded-3xl bg-[#3b6ce6]/30 blur-xl" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[#3b6ce6] to-[#00041d] text-white shadow-[0_18px_40px_-14px_rgba(31,65,137,0.7)] ring-1 ring-white/20">
            <Icon className="h-9 w-9" strokeWidth={1.6} />
          </span>
        </span>
      )}
      {title && <p className="text-2xl font-extrabold tracking-[-0.03em] text-foreground">{title}</p>}
      {description && <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
