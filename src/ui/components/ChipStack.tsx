/**
 * ChipStack — renders a decomposed chip stack for a dollar amount.
 * Chips are stacked with a slight vertical offset to give a 3D appearance.
 * Falls back to colored circles if the image hasn't been dropped in yet.
 */
import { View, Text, Image, StyleSheet } from 'react-native';

// ── Chip catalogue ──────────────────────────────────────────────────────────

export type ChipDenom = 1 | 5 | 10 | 20 | 50 | 100 | 500 | 1000;

interface ChipMeta {
  denom: ChipDenom;
  label: string;
  bg: string;      // fallback colour
  border: string;
  textColor: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  image: any;      // require() result — null uses coloured-circle fallback
}

const CHIP_META: ChipMeta[] = [
  { denom: 1000, label: '$1K',  bg: '#1a1a1a', border: '#c8a84b', textColor: '#c8a84b', image: require('../../../assets/chips/chip_1000.png') },
  { denom: 500,  label: '$500', bg: '#1a1a1a', border: '#b8962e', textColor: '#b8962e', image: require('../../../assets/chips/chip_500.png') },
  { denom: 100,  label: '$100', bg: '#1a1a1a', border: '#c8a84b', textColor: '#c8a84b', image: require('../../../assets/chips/chip_100.png') },
  { denom: 50,   label: '$50',  bg: '#b34700', border: '#e06520', textColor: '#fff',    image: require('../../../assets/chips/chip_50.png') },
  { denom: 20,   label: '$20',  bg: '#1b5e20', border: '#43a047', textColor: '#fff',    image: require('../../../assets/chips/chip_20.png') },
  { denom: 10,   label: '$10',  bg: '#0d3a7a', border: '#1976d2', textColor: '#fff',    image: require('../../../assets/chips/chip_10.png') },
  { denom: 5,    label: '$5',   bg: '#8b0000', border: '#c62828', textColor: '#fff',    image: require('../../../assets/chips/chip_5.png') },
  { denom: 1,    label: '$1',   bg: '#1a237e', border: '#3949ab', textColor: '#fff',    image: require('../../../assets/chips/chip_1.png') },
];

// ── Decompose amount into chip groups ────────────────────────────────────────

function decompose(amount: number): { meta: ChipMeta; count: number }[] {
  const groups: { meta: ChipMeta; count: number }[] = [];
  let rem = amount;
  for (const meta of CHIP_META) {
    const count = Math.floor(rem / meta.denom);
    if (count > 0) {
      groups.push({ meta, count });
      rem -= count * meta.denom;
    }
  }
  return groups;
}

// ── Single chip (image or coloured circle fallback) ──────────────────────────

interface SingleChipProps {
  meta: ChipMeta;
  size: number;
}

function SingleChip({ meta, size }: SingleChipProps) {
  if (meta.image) {
    return (
      <Image
        source={meta.image}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  return (
    <View style={[
      styles.fallbackChip,
      { width: size, height: size, borderRadius: size / 2, backgroundColor: meta.bg, borderColor: meta.border },
    ]}>
      <Text style={[styles.fallbackLabel, { color: meta.textColor, fontSize: size * 0.22 }]}>
        {meta.label}
      </Text>
    </View>
  );
}

// ── Chip stack (single denomination) ────────────────────────────────────────

const MAX_VISIBLE = 8;
const STACK_OFFSET = 5; // px each chip shifts down

interface StackGroupProps {
  meta: ChipMeta;
  count: number;
  chipSize: number;
}

function StackGroup({ meta, count, chipSize }: StackGroupProps) {
  const visible = Math.min(count, MAX_VISIBLE);
  const totalHeight = chipSize + (visible - 1) * STACK_OFFSET;

  return (
    <View style={{ width: chipSize, height: totalHeight, alignItems: 'center' }}>
      {Array.from({ length: visible }).map((_, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            top: i * STACK_OFFSET,
            // Shadow on lower chips
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 2 },
            elevation: visible - i,
          }}
        >
          <SingleChip meta={meta} size={chipSize} />
        </View>
      ))}
      {count > MAX_VISIBLE && (
        <View style={[styles.countBadge, { top: totalHeight - 12 }]}>
          <Text style={styles.countText}>×{count}</Text>
        </View>
      )}
    </View>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

interface ChipStackProps {
  amount: number;
  chipSize?: number;
  /** show the total dollar amount below the stack */
  showTotal?: boolean;
}

export function ChipStack({ amount, chipSize = 44, showTotal = true }: ChipStackProps) {
  const groups = decompose(amount);

  if (groups.length === 0) {
    return (
      <View style={styles.emptyPot}>
        <Text style={styles.emptyText}>—</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.stacksRow}>
        {groups.map(({ meta, count }) => (
          <StackGroup key={meta.denom} meta={meta} count={count} chipSize={chipSize} />
        ))}
      </View>
      {showTotal && (
        <Text style={styles.totalLabel}>${amount}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackChip: {
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackLabel: {
    fontWeight: '900',
  },
  countBadge: {
    position: 'absolute',
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  countText: {
    color: '#ffd700',
    fontSize: 8,
    fontWeight: '800',
  },
  wrapper: {
    alignItems: 'center',
    gap: 6,
  },
  stacksRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  totalLabel: {
    color: '#ffd700',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyPot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: '#3a5a3a',
    fontSize: 18,
  },
});
