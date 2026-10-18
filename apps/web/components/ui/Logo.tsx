import styles from "./Logo.module.css";

/**
 * The Remindly mark — italic "r" with a coral dot on paper, same as the app
 * icon. Built from text so it stays sharp at any size; proportions follow the
 * 180px icon design (r = 150px, dot = 22px).
 */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <span aria-hidden className={styles.logo} style={{ "--s": `${size}px` } as React.CSSProperties}>
      <span className={styles.mark}>
        <span className={styles.r}>r</span>
        <span className={styles.dot} />
      </span>
    </span>
  );
}
