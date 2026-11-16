import type { ThemeConfig } from "antd";

const antdTheme: ThemeConfig = {
  token: {
    /*
     * Forever Hotel brand
     */
    colorPrimary: "#1A3C5E",
    colorLink: "#1A3C5E",

    /*
     * Semantic colours
     */
    colorSuccess: "#1A6B3C",
    colorError: "#8B1A1A",
    colorWarning: "#C9920D",

    /*
     * Surfaces
     */
    colorBgLayout: "#F5F3EF",
    colorBgContainer: "#FFFFFF",
    colorBgElevated: "#FFFFFF",

    /*
     * Text
     */
    colorText: "#1A1A18",
    colorTextSecondary: "#5A5650",

    /*
     * Borders
     */
    colorBorder: "#DDD8CF",
    colorBorderSecondary: "#E8E3DC",

    /*
     * Shape and sizing
     */
    borderRadius: 4,
    borderRadiusLG: 6,
    borderRadiusSM: 3,

    fontSize: 13,

    /*
     * Controls
     */
    controlHeight: 34,
    controlHeightSM: 28,
    controlHeightLG: 40,
  },

  components: {
    Button: {
      primaryShadow: "none",

      defaultBorderColor: "#CDD2CF",
      defaultColor: "#1A1A18",

      borderRadius: 4,
    },

    Input: {
      activeBorderColor: "#2E5F8A",
      hoverBorderColor: "#2E5F8A",

      activeShadow: "0 0 0 2px rgba(46, 95, 138, 0.10)",
    },

    Select: {
      activeBorderColor: "#2E5F8A",
      hoverBorderColor: "#2E5F8A",

      activeOutlineColor: "rgba(46, 95, 138, 0.10)",
    },

    Table: {
      headerBg: "#E8EEF4",
      headerColor: "#4D5358",

      borderColor: "#DDD8CF",

      rowHoverBg: "#FAF9F6",
    },

    Tag: {
      borderRadiusSM: 999,
    },
  },
};

export default antdTheme;
