import { Film, Gauge, Sparkles, Wand2 } from "lucide-react";
import { motion } from "motion/react";
import {
  Box,
  Deck,
  FlexBox,
  Grid,
  Heading,
  ListItem,
  Notes,
  Slide,
  Text,
  UnorderedList,
} from "spectacle";
import { InsightChart } from "../../src/components/InsightChart";
import { MotionBadge } from "../../src/components/MotionBadge";
import { Template } from "../../src/components/Template";
import { prezzoTheme } from "../../src/theme";

export function PrezzoDeck() {
  return (
    <Deck theme={prezzoTheme} template={Template}>
      <Slide backgroundColor="#101418">
        <FlexBox className="slide-shell" flexDirection="column" justifyContent="center">
          <Text className="kicker" color="#f3b23a">
            React presentation system
          </Text>
          <motion.div
            initial={{ opacity: 0, y: 34 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <Heading fontSize="132px" color="#f8f3e7" margin="12px 0 0">
              Prezzo
            </Heading>
          </motion.div>
          <Text color="rgba(248,243,231,0.84)" fontSize="38px" maxWidth="980px">
            Like your normal presentation deck, except the slides are React and the
            big moments can become real video.
          </Text>
          <FlexBox gap="18px" marginTop="44px">
            <MotionBadge>live talks</MotionBadge>
            <MotionBadge delay={0.12}>rendered motion</MotionBadge>
            <MotionBadge delay={0.24}>agent-built stories</MotionBadge>
          </FlexBox>
          <Notes>
            Open with the simple promise: keep the deck workflow familiar, but remove
            the ceiling on what a slide can be.
          </Notes>
        </FlexBox>
      </Slide>

      <Slide backgroundColor="#f8f3e7">
        <Grid className="slide-shell" gridTemplateColumns="1fr 0.9fr" gridGap="56px">
          <FlexBox flexDirection="column" justifyContent="center">
            <Text className="kicker">Baseline</Text>
            <Heading fontSize="72px" margin="8px 0 28px">
              PowerPoint muscle memory, React surface area.
            </Heading>
            <UnorderedList fontSize="34px" lineHeight={1.25}>
              <ListItem>JSX slides with Spectacle navigation and presenter notes.</ListItem>
              <ListItem>Motion for tasteful in-browser transitions and gestures.</ListItem>
              <ListItem>Charts, live components, videos, GIFs, demos, and generated assets.</ListItem>
            </UnorderedList>
          </FlexBox>
          <FlexBox className="deck-card" padding="34px" flexDirection="column" justifyContent="center">
            <InsightChart />
            <Text fontSize="24px" color="rgba(16,20,24,0.66)">
              The useful axis is not prettier slides. It is richer explanation per minute.
            </Text>
          </FlexBox>
        </Grid>
      </Slide>

      <Slide backgroundColor="#101418">
        <Grid className="slide-shell" gridTemplateColumns="0.95fr 1fr" gridGap="44px">
          <FlexBox flexDirection="column" justifyContent="center">
            <Text className="kicker" color="#f3b23a">
              Agent loop
            </Text>
            <Heading fontSize="70px" color="#f8f3e7" margin="8px 0 24px">
              Brief, storyboard, build, inspect, tighten.
            </Heading>
            <Text color="rgba(248,243,231,0.75)" fontSize="31px">
              Agents should work from a narrative brief, create a slide map, implement
              components, then verify the deck visually before calling it done.
            </Text>
          </FlexBox>
          <Grid gridTemplateColumns="1fr 1fr" gridGap="18px" alignContent="center">
            {[
              [Wand2, "Outline", "Turn messy intent into a tight run of show."],
              [Gauge, "Prototype", "Use real components where a static mock would lie."],
              [Film, "Render", "Move hero moments into Remotion when timing matters."],
              [Sparkles, "Polish", "Check pacing, hierarchy, contrast, and fit."],
            ].map(([Icon, title, body], index) => {
              const Glyph = Icon as typeof Wand2;

              return (
                <motion.div
                  className="glass-dark"
                  key={title as string}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.12, duration: 0.4 }}
                  style={{ minHeight: 210, padding: 26 }}
                >
                  <Glyph size={34} color="#f3b23a" />
                  <Text color="#f8f3e7" fontSize="32px" fontWeight={900} margin="18px 0 8px">
                    {title as string}
                  </Text>
                  <Text color="rgba(248,243,231,0.72)" fontSize="22px">
                    {body as string}
                  </Text>
                </motion.div>
              );
            })}
          </Grid>
        </Grid>
      </Slide>

      <Slide backgroundColor="#f8f3e7">
        <Grid className="slide-shell" gridTemplateColumns="1fr 1fr" gridGap="48px">
          <Box>
            <Text className="kicker">Wow layer</Text>
            <Heading fontSize="68px" margin="8px 0 22px">
              Keep slides scannable. Let media do the impossible bit.
            </Heading>
            <Text fontSize="31px" color="rgba(16,20,24,0.72)">
              Use embedded clips for evidence, GIFs for quick demos, Motion for live
              reveal, and Remotion for the few sequences that need exact timing.
            </Text>
          </Box>
          <FlexBox className="media-stage" minHeight="560px" alignItems="center" justifyContent="center">
            <motion.div
              initial={{ rotate: -4, scale: 0.9 }}
              animate={{ rotate: 3, scale: 1 }}
              transition={{ duration: 0.9, repeat: Infinity, repeatType: "reverse" }}
              style={{
                background: "#f8f3e7",
                borderRadius: 8,
                padding: 34,
                position: "relative",
                zIndex: 1,
                width: 420,
              }}
            >
              <Text color="#101418" fontSize="30px" fontWeight={900} margin="0 0 10px">
                video scene
              </Text>
              <Text fontSize="22px" margin="0" color="rgba(16,20,24,0.68)">
                animated, data-driven, exportable
              </Text>
            </motion.div>
          </FlexBox>
        </Grid>
      </Slide>

      <Slide backgroundColor="#101418">
        <FlexBox className="slide-shell" flexDirection="column" justifyContent="center">
          <Text className="kicker" color="#f3b23a">
            v0 promise
          </Text>
          <Heading fontSize="82px" color="#f8f3e7" margin="8px 0 24px">
            A deck is now a product surface.
          </Heading>
          <Text color="rgba(248,243,231,0.78)" fontSize="34px" maxWidth="1080px">
            Prezzo should make it natural for an agent to move from a spoken idea to a
            polished live deck, then export selected motion graphics without rebuilding
            the story in another tool.
          </Text>
        </FlexBox>
      </Slide>
    </Deck>
  );
}
